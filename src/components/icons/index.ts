import iconsData from "@/lib/icons.json";

export type IconEntry = {
  id: string;
  label: string;
  file: string;
  width: number;
  height: number;
  tags: string[];
};

function humanize(id: string): string {
  return id
    .replace(/^ibm-pictograms-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const allIcons: IconEntry[] = Object.entries(
  iconsData.icons as Record<
    string,
    { path: string; width: number; height: number; tags: string[] }
  >
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
  return `/ibm-icons/${iconId}.svg`;
}

/** Built-ins are always bundled SVG glyphs. User uploads belong in Images. */
/** @param iconId IBM pictogram id (unused — all built-ins are SVG). */
export function getIconFormat(iconId: string): "svg" {
  void iconId;
  return "svg";
}

function matchesQuery(icon: IconEntry, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack =
    `${icon.id} ${icon.label} ${icon.tags.join(" ")}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function searchIcons(query: string): IconEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return allIcons.filter((icon) => matchesQuery(icon, terms));
}
