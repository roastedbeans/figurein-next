"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pageSignature, useEditorStore } from "@/stores/editor-store";
import { loadProject, saveProject } from "@/app/editor/actions";

export type SaveStatus =
  | "idle"
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "error";

// 800ms is a compromise: long enough to collapse a burst of edits (drag,
// type, color-pick), short enough that users feel "save happened" before
// they tab away. Tuned together with the server action's transaction.
const AUTO_SAVE_DEBOUNCE_MS = 800;

// TEMP: kill-switch for the autosave subscription + network trip while we
// profile whether the per-mutation signature hashing / subscribe callback is
// contributing to canvas lag. Flip back to false to re-enable autosave.
const DISABLE_AUTOSAVE = false;

/**
 * Binds a project in the editor store to its `projects` + `figures` rows.
 *
 * - On mount / projectId change: loads the snapshot and hydrates the store.
 * - On any mutation to saveable state: schedules a debounced delta save.
 *   Only dirty pages (tracked in the store) are serialized and sent.
 * - Per-page content hashes filter out "dirty but content-identical" pages
 *   (e.g. user typed then undid) so those don't round-trip to the server.
 * - Concurrent save guard: if a save is already in flight, mark pending
 *   and re-fire once it resolves so the latest state lands.
 * - Cmd/Ctrl+S triggers `saveNow` to flush the debounce immediately.
 */
export function useProjectPersistence(projectId: string | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // loadedRef gates auto-save off until the initial load finishes —
  // otherwise the `loadProject` store call itself would look like a
  // mutation and we'd immediately save the snapshot back.
  const loadedRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Per-page content hashes for what we've successfully persisted. The
  // store's `dirtyPageIds` tells us "was mutated"; this map tells us "is
  // the content actually different from the server." A page that matches
  // here is filtered out before the network call.
  const pageSignaturesRef = useRef<Map<string, string>>(new Map());
  // Last persisted project title. Gates the server-side title UPDATE so a
  // dirty-by-page save doesn't round-trip `projects.title` every 800ms.
  const projectTitleRef = useRef<string | null>(null);

  // scheduleSave is forward-referenced from doSave's re-fire path. Use a
  // ref so doSave can stay [] deps and capture a stable handle.
  const scheduleSaveRef = useRef<() => void>(() => {});

  const doSave = useCallback(async () => {
    const id = projectIdRef.current;
    if (!id || !loadedRef.current) return;
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }

    const delta = useEditorStore.getState().getDirtyDelta();

    // Hash every dirty page. Drop any whose hash matches what we last
    // persisted for that id — the page got touched but its content is
    // byte-identical to the server.
    const pagesToSend: typeof delta.pages = [];
    const sentHashes: Array<[string, string]> = [];
    const noopHashes: Array<[string, string]> = [];
    for (const page of delta.pages) {
      const hash = pageSignature(page);
      if (pageSignaturesRef.current.get(page.id) === hash) {
        noopHashes.push([page.id, hash]);
        continue;
      }
      pagesToSend.push(page);
      sentHashes.push([page.id, hash]);
    }

    const titleChanged =
      delta.projectDirty && projectTitleRef.current !== delta.projectTitle;

    // Nothing to persist: clear the dirty flags for any pages we deduped
    // (so the store's dirty set shrinks and future subscribe events don't
    // re-trigger pointless saves) and leave status alone.
    if (
      pagesToSend.length === 0 &&
      delta.deletedIds.length === 0 &&
      !titleChanged
    ) {
      if (noopHashes.length > 0 || delta.projectDirty) {
        useEditorStore.getState().markSaved({
          pageSignatures: noopHashes,
          deletedIds: [],
          projectSignature: delta.projectDirty ? delta.projectTitle : undefined,
        });
      }
      return;
    }

    savingRef.current = true;
    pendingRef.current = false;
    if (!unmountedRef.current) {
      setStatus("saving");
      setError(null);
    }

    try {
      const result = await saveProject(id, {
        projectTitle: titleChanged ? delta.projectTitle : undefined,
        pages: pagesToSend,
        deletedIds: delta.deletedIds,
        currentPageId: delta.currentPageId,
      });
      if (unmountedRef.current) return;
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
      } else {
        // Record what we persisted: sent pages get their new hash, deleted
        // pages drop out of the map, and the title ref catches up.
        for (const [pageId, hash] of sentHashes) {
          pageSignaturesRef.current.set(pageId, hash);
        }
        for (const deletedId of delta.deletedIds) {
          pageSignaturesRef.current.delete(deletedId);
        }
        if (titleChanged) {
          projectTitleRef.current = delta.projectTitle;
        }
        // Acknowledge to the store. `markSaved` only clears a page's dirty
        // flag if the page's current hash still matches what we sent —
        // mid-save mutations stay dirty so the pending re-fire picks them
        // up. Include the deduped-but-identical pages in the ack so their
        // spurious dirty flags clear too.
        useEditorStore.getState().markSaved({
          pageSignatures: [...sentHashes, ...noopHashes],
          deletedIds: delta.deletedIds,
          projectSignature: titleChanged ? delta.projectTitle : undefined,
        });
        setStatus("saved");
      }
    } catch (e) {
      if (!unmountedRef.current) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      savingRef.current = false;
      // A mutation landed while this save was in flight — re-fire so the
      // user's most recent state is what ends up persisted.
      if (pendingRef.current && !unmountedRef.current) {
        pendingRef.current = false;
        scheduleSaveRef.current();
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void doSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [doSave]);

  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  // Load on mount / projectId change.
  useEffect(() => {
    unmountedRef.current = false;
    if (!projectId) {
      setStatus("idle");
      loadedRef.current = false;
      pageSignaturesRef.current = new Map();
      projectTitleRef.current = null;
      return;
    }

    let cancelled = false;
    loadedRef.current = false;
    pageSignaturesRef.current = new Map();
    projectTitleRef.current = null;
    setStatus("loading");
    setError(null);

    (async () => {
      const result = await loadProject(projectId);
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
        return;
      }
      // Apply the snapshot BEFORE flipping loadedRef so the store
      // mutation doesn't trigger an immediate save-back.
      useEditorStore.getState().loadProject(result.projectTitle, {
        projectTitle: result.projectTitle,
        pages: result.pages,
        currentPageId: result.currentPageId,
      });
      // Seed per-page signatures from the loaded pages — each entry
      // represents "what the server has" so subsequent deltas can dedup.
      const seeded = new Map<string, string>();
      for (const p of result.pages) {
        seeded.set(p.id, pageSignature(p));
      }
      pageSignaturesRef.current = seeded;
      projectTitleRef.current = result.projectTitle;
      loadedRef.current = true;
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Subscribe to saveable-state changes. Identity compare is sufficient
  // because the store replaces the top-level arrays on every mutation
  // and flips the dirty sets when page structure changes.
  useEffect(() => {
    if (!projectId) return;
    if (DISABLE_AUTOSAVE) return;

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (!loadedRef.current) return;
      if (
        state.pages === prev.pages &&
        state.elements === prev.elements &&
        state.projectTitle === prev.projectTitle &&
        state.deletedPageIds === prev.deletedPageIds
      ) {
        return;
      }
      scheduleSave();
    });

    return () => {
      unsubscribe();
    };
  }, [projectId, scheduleSave]);

  const saveNow = useCallback(async () => {
    if (DISABLE_AUTOSAVE) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await doSave();
  }, [doSave]);

  // Unmount: flush pending edits, then shut down. Server action keeps
  // running detached from the component tree; state updates are gated
  // by unmountedRef so they become no-ops.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        if (!DISABLE_AUTOSAVE) void doSave();
      }
    };
  }, [doSave]);

  return { status, error, saveNow };
}
