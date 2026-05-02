"use client";

import { create } from "zustand";
import {
  listCustomIcons,
  type CustomIconRow,
} from "@/app/editor/custom-icons";

// Client-side cache of the user's custom icon library. One fetch per
// session — the list is mutated optimistically on upload/delete so we don't
// round-trip to the server to see the row we just created.

type State = {
  icons: CustomIconRow[];
  loaded: boolean;
  loading: boolean;
};

type Actions = {
  load: () => Promise<void>;
  addIcon: (icon: CustomIconRow) => void;
  removeIcon: (id: string) => void;
  getById: (id: string) => CustomIconRow | undefined;
};

let inFlight: Promise<void> | null = null;

export const useCustomIconsStore = create<State & Actions>((set, get) => ({
  icons: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;
    set({ loading: true });
    inFlight = (async () => {
      try {
        const icons = await listCustomIcons();
        set({ icons, loaded: true, loading: false });
      } catch {
        set({ loading: false });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  addIcon: (icon) =>
    set((s) => ({
      icons: [icon, ...s.icons.filter((i) => i.id !== icon.id)],
    })),

  removeIcon: (id) =>
    set((s) => ({ icons: s.icons.filter((i) => i.id !== id) })),

  getById: (id) => get().icons.find((i) => i.id === id),
}));
