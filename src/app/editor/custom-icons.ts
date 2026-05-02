"use server";

import { and, desc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db/client";
import { customIcons } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// Server actions for the user's custom icon library. Files live in the
// `custom-icons` storage bucket and are served from Supabase's public CDN;
// metadata (name, format, dimensions) lives in `public.custom_icons`.

const BUCKET = "custom-icons";
const MAX_DIMENSION = 256;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES: Record<string, "svg" | "png" | "jpg"> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

export type CustomIconRow = {
  id: string;
  name: string;
  format: "svg" | "png" | "jpg";
  url: string;
  width: number | null;
  height: number | null;
};

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Minimal SVG sanitizer. We only accept user-authored SVG icons for
// rendering inside the editor's SVG DOM — scripts, event handlers, and
// external hrefs are removal-worthy regardless of optimization.
function sanitizeSvg(text: string): string {
  return text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript:|data:text\/html)[^"']*("|')/gi, "")
    .trim();
}

type Optimized = {
  buffer: Buffer;
  contentType: string;
  format: "svg" | "png" | "jpg";
  width: number | null;
  height: number | null;
};

async function optimize(
  file: File,
  declaredFormat: "svg" | "png" | "jpg"
): Promise<Optimized> {
  const raw = Buffer.from(await file.arrayBuffer());

  if (declaredFormat === "svg") {
    const cleaned = sanitizeSvg(raw.toString("utf-8"));
    return {
      buffer: Buffer.from(cleaned, "utf-8"),
      contentType: "image/svg+xml",
      format: "svg",
      width: null,
      height: null,
    };
  }

  // Raster: resize so the longer edge is <= 256px, preserve aspect ratio.
  // PNG keeps transparency; JPG is recompressed at a quality that's easy on
  // bandwidth without visible artifacts for icon-sized images.
  const pipeline = sharp(raw, { failOn: "none" }).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (declaredFormat === "png") {
    const out = await pipeline
      .png({ compressionLevel: 9, palette: true })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      contentType: "image/png",
      format: "png",
      width: out.info.width,
      height: out.info.height,
    };
  }

  const out = await pipeline
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: out.data,
    contentType: "image/jpeg",
    format: "jpg",
    width: out.info.width,
    height: out.info.height,
  };
}

export async function uploadCustomIcon(
  formData: FormData
): Promise<{ error: string } | { icon: CustomIconRow }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file attached." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File is too large (max 5 MB)." };
  }

  const declared = ALLOWED_MIMES[file.type];
  if (!declared) {
    return { error: "Unsupported file type. Use SVG, PNG, or JPG." };
  }

  const nameFromFile = file.name.replace(/\.[^./\\]+$/, "").trim();
  const displayName = (formData.get("name") as string | null)?.trim() ||
    nameFromFile ||
    "Untitled icon";

  let optimized: Optimized;
  try {
    optimized = await optimize(file, declared);
  } catch {
    return { error: "Could not process this file." };
  }

  const iconId = crypto.randomUUID();
  const ext = optimized.format === "jpg" ? "jpg" : optimized.format;
  const storagePath = `${userId}/${iconId}.${ext}`;

  const supabase = await createClient();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, optimized.buffer, {
      contentType: optimized.contentType,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  try {
    await db.insert(customIcons).values({
      id: iconId,
      ownerId: userId,
      name: displayName.slice(0, 120),
      format: optimized.format,
      storagePath,
      sizeBytes: optimized.buffer.byteLength,
      width: optimized.width,
      height: optimized.height,
    });
  } catch (err) {
    // If the metadata insert fails, roll back the upload so the bucket
    // doesn't accumulate orphaned files.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }

  return {
    icon: {
      id: iconId,
      name: displayName.slice(0, 120),
      format: optimized.format,
      url: publicUrl(storagePath),
      width: optimized.width,
      height: optimized.height,
    },
  };
}

export async function listCustomIcons(): Promise<CustomIconRow[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const rows = await db
    .select({
      id: customIcons.id,
      name: customIcons.name,
      format: customIcons.format,
      storagePath: customIcons.storagePath,
      width: customIcons.width,
      height: customIcons.height,
    })
    .from(customIcons)
    .where(eq(customIcons.ownerId, userId))
    .orderBy(desc(customIcons.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    format: r.format as "svg" | "png" | "jpg",
    url: publicUrl(r.storagePath),
    width: r.width,
    height: r.height,
  }));
}

export async function deleteCustomIcon(
  id: string
): Promise<{ error: string } | { ok: true }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const [row] = await db
    .select({ storagePath: customIcons.storagePath })
    .from(customIcons)
    .where(and(eq(customIcons.id, id), eq(customIcons.ownerId, userId)))
    .limit(1);
  if (!row) return { error: "Icon not found" };

  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([row.storagePath]);
  await db
    .delete(customIcons)
    .where(and(eq(customIcons.id, id), eq(customIcons.ownerId, userId)));

  return { ok: true };
}
