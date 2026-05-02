import iconsData from "@/lib/icons.json";
import { useCustomIconsStore } from "@/stores/custom-icons-store";

export type IconEntry = {
  id: string;
  label: string;
  file: string;
  width: number;
  height: number;
  tags: string[];
};

/** Custom icon IDs are stored on elements as `custom:<uuid>`. Everything
 *  else is a built-in IBM pictogram id. The prefix lets URL + render code
 *  route to the Supabase CDN instead of the bundled /ibm-icons folder. */
export const CUSTOM_ICON_PREFIX = "custom:";

export function isCustomIconId(iconId: string): boolean {
  return iconId.startsWith(CUSTOM_ICON_PREFIX);
}

export function customIconIdFromUuid(uuid: string): string {
  return `${CUSTOM_ICON_PREFIX}${uuid}`;
}

export function uuidFromCustomIconId(iconId: string): string {
  return iconId.slice(CUSTOM_ICON_PREFIX.length);
}

function humanize(id: string): string {
  return id
    .replace(/^ibm-pictograms-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const allIcons: IconEntry[] = Object.entries(
  iconsData.icons as Record<string, { path: string; width: number; height: number; tags: string[] }>
).map(([id, meta]) => ({
  id,
  label: humanize(id),
  file: `${id}.svg`,
  width: meta.width,
  height: meta.height,
  tags: meta.tags ?? [],
}));

export { allIcons };

export function getIconUrl(iconId: string): string {
  if (isCustomIconId(iconId)) {
    const uuid = uuidFromCustomIconId(iconId);
    const entry = useCustomIconsStore.getState().getById(uuid);
    return entry?.url ?? "";
  }
  return `/ibm-icons/${iconId}.svg`;
}

/** Format hint for rendering: SVG icons can be mask-recolored; raster icons
 *  (PNG/JPG) must render as an image so the user's pixels come through. */
export function getIconFormat(iconId: string): "svg" | "png" | "jpg" {
  if (isCustomIconId(iconId)) {
    const uuid = uuidFromCustomIconId(iconId);
    const entry = useCustomIconsStore.getState().getById(uuid);
    return entry?.format ?? "svg";
  }
  return "svg";
}

function matchesQuery(icon: IconEntry, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = `${icon.id} ${icon.label} ${icon.tags.join(" ")}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function searchIcons(query: string): IconEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return allIcons.filter((icon) => matchesQuery(icon, terms));
}
