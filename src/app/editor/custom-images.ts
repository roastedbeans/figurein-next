"use server";

import { and, desc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db/client";
import { customImages } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { ensureCustomImagesBucketFromDb } from "@/lib/ensure-custom-images-bucket";

const BUCKET = "custom-images";

function storageFriendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket") && m.includes("not found")) {
    return (
      `Storage bucket "${BUCKET}" missing. Ensure DATABASE_URL has permission to insert into ` +
      `storage.buckets / storage.objects policies, run migration 0007_ensure_custom_images_bucket.sql, ` +
      `or create a public bucket "${BUCKET}" manually. ${message}`
    );
  }
  return message;
}

const MAX_RASTER_BYTES = 12 * 1024 * 1024;
const MAX_SVG_BYTES = 2 * 1024 * 1024;

const ALLOWED_RASTER_MIMES: Record<string, "png" | "jpg" | "gif" | "webp"> =
  {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };

const RASTER_CONTENT_TYPE: Record<
  (typeof ALLOWED_RASTER_MIMES)[string],
  string
> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export type CustomImageRow = {
  id: string;
  name: string;
  format: "png" | "jpg" | "gif" | "webp" | "svg";
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

function publicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function parseSvgCssNumber(value: string): number | null {
  const m = value.trim().match(/^([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Best-effort intrinsic size for editor placement (viewBox preferred). */
function svgIntrinsicDimensions(svg: string): {
  width: number | null;
  height: number | null;
} {
  const viewBox = svg.match(/\bviewBox\s*=\s*(["'])([\s\S]*?)\1/i);
  if (viewBox) {
    const parts = viewBox[2].trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      const w = Number(parts[2]);
      const h = Number(parts[3]);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return { width: w, height: h };
      }
    }
  }
  const wAttr = svg.match(/\bwidth\s*=\s*(["'])([^"']*)\1/i);
  const hAttr = svg.match(/\bheight\s*=\s*(["'])([^"']*)\1/i);
  const aw = wAttr ? parseSvgCssNumber(wAttr[2]) : null;
  const ah = hAttr ? parseSvgCssNumber(hAttr[2]) : null;
  if (aw != null && ah != null) return { width: aw, height: ah };
  return { width: null, height: null };
}

function sanitizeSvg(text: string): string {
  return text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "")
    .replace(
      /(href|xlink:href)\s*=\s*("|')\s*(javascript:|data:text\/html)[^"']*("|')/gi,
      ""
    )
    .trim();
}

async function rasterDimensions(
  buffer: Buffer
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export async function uploadCustomImage(
  formData: FormData
): Promise<{ error: string } | { image: CustomImageRow }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  await ensureCustomImagesBucketFromDb();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file attached." };

  const nameFromFile = file.name.replace(/\.[^./\\]+$/, "").trim();
  const displayName = (formData.get("name") as string | null)?.trim() ||
    nameFromFile ||
    "Image";

  const imageId = crypto.randomUUID();
  const supabase = await createClient();

  let buffer: Buffer;
  let format: CustomImageRow["format"];
  let contentType: string;
  let width: number | null = null;
  let height: number | null = null;

  if (file.type === "image/svg+xml") {
    if (file.size > MAX_SVG_BYTES) {
      return { error: "SVG is too large (max 2 MB)." };
    }
    try {
      const cleaned = sanitizeSvg(
        Buffer.from(await file.arrayBuffer()).toString("utf-8")
      );
      buffer = Buffer.from(cleaned, "utf-8");
      const intr = svgIntrinsicDimensions(cleaned);
      width =
        intr.width != null ? Math.round(Math.min(intr.width, 8192)) : null;
      height =
        intr.height != null ? Math.round(Math.min(intr.height, 8192)) : null;
    } catch {
      return { error: "Could not read this SVG." };
    }
    format = "svg";
    contentType = "image/svg+xml";
  } else {
    if (file.size > MAX_RASTER_BYTES) {
      return { error: "File is too large (max 12 MB)." };
    }
    const declared = ALLOWED_RASTER_MIMES[file.type];
    if (!declared) {
      return { error: "Unsupported type. Use SVG, PNG, JPEG, GIF, or WebP." };
    }
    buffer = Buffer.from(await file.arrayBuffer());
    ({ width, height } = await rasterDimensions(buffer));
    format = declared;
    contentType = RASTER_CONTENT_TYPE[declared];
  }

  const ext = format === "jpg" ? "jpg" : format;
  const storagePath = `${userId}/${imageId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (uploadErr)
    return { error: storageFriendlyError(uploadErr.message) };

  try {
    await db.insert(customImages).values({
      id: imageId,
      ownerId: userId,
      name: displayName.slice(0, 120),
      format,
      storagePath,
      sizeBytes: buffer.byteLength,
      width,
      height,
    });
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }

  return {
    image: {
      id: imageId,
      name: displayName.slice(0, 120),
      format,
      url: publicUrl(storagePath),
      width,
      height,
    },
  };
}

export async function listCustomImages(): Promise<CustomImageRow[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const rows = await db
    .select({
      id: customImages.id,
      name: customImages.name,
      format: customImages.format,
      storagePath: customImages.storagePath,
      width: customImages.width,
      height: customImages.height,
    })
    .from(customImages)
    .where(eq(customImages.ownerId, userId))
    .orderBy(desc(customImages.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    format: r.format as CustomImageRow["format"],
    url: publicUrl(r.storagePath),
    width: r.width,
    height: r.height,
  }));
}

export async function deleteCustomImage(
  id: string
): Promise<{ error: string } | { ok: true }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const [row] = await db
    .select({ storagePath: customImages.storagePath })
    .from(customImages)
    .where(and(eq(customImages.id, id), eq(customImages.ownerId, userId)))
    .limit(1);
  if (!row) return { error: "Image not found" };

  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([row.storagePath]);
  await db
    .delete(customImages)
    .where(and(eq(customImages.id, id), eq(customImages.ownerId, userId)));

  return { ok: true };
}
