#!/usr/bin/env node
// Scan public/ibm-icons/*.svg and normalize hardcoded colors that prevent
// runtime recoloring. Any explicit color value on a fill/stroke inside a
// style="..." attribute is replaced with `inherit` so the shape picks up the
// root SVG's `fill="currentColor"` (which the editor controls via the element's
// color prop). `fill:none` and `stroke:none` are preserved — those shapes are
// intentionally transparent.
//
// Usage:
//   node scripts/fix-icon-colors.mjs          # rewrite in place
//   node scripts/fix-icon-colors.mjs --dry    # report changes without writing

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(__dirname, "..", "public", "ibm-icons");
const DRY = process.argv.includes("--dry");

// Replace a CSS declaration value for `prop` inside a style string.
// Leaves `none`, `inherit`, `currentColor`, and CSS variables alone.
// Returns { next, replaced } — `replaced` is true if we rewrote a color.
function normalizeStyleDecl(styleValue, prop) {
  let replaced = false;
  const re = new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+?)\\s*(;|$)`, "gi");
  const next = styleValue.replace(re, (match, lead, value, tail) => {
    const v = value.trim().toLowerCase();
    if (v === "none" || v === "inherit" || v === "currentcolor" || v.startsWith("var(")) {
      return match;
    }
    replaced = true;
    return `${lead}${prop}:inherit${tail}`;
  });
  return { next, replaced };
}

// Ensure the root <svg> has an attribute of the form `name="currentColor"`
// so that descendants using `prop:inherit` have something to inherit from.
function ensureRootAttr(head, name) {
  const attrRe = new RegExp(`\\b${name}="[^"]*"`);
  if (attrRe.test(head)) return head;
  // Insert right before the closing `>` of the opening <svg ...> tag.
  return head.replace(/>\s*$/, ` ${name}="currentColor">`);
}

// Replace style="..." attribute bodies and also bare fill=/stroke= attributes
// that point at a concrete color.
function fixSvg(src) {
  let changed = false;
  let needRootFill = false;
  let needRootStroke = false;

  // style="...fill:COLOR..." and stroke
  let out = src.replace(/style="([^"]*)"/g, (m, body) => {
    const f = normalizeStyleDecl(body, "fill");
    const s = normalizeStyleDecl(f.next, "stroke");
    if (s.next !== body) {
      changed = true;
      if (f.replaced) needRootFill = true;
      if (s.replaced) needRootStroke = true;
      return `style="${s.next}"`;
    }
    return m;
  });

  // Touch fill=/stroke= only on non-root elements (i.e. anywhere after the
  // first closing `>` of the opening <svg ...> tag). The root keeps its
  // declarative fill/stroke="currentColor" so `inherit` on children resolves.
  const rootEnd = out.indexOf(">", out.indexOf("<svg"));
  let head = out.slice(0, rootEnd + 1);
  const body = out.slice(rootEnd + 1);
  const fixedBody = body.replace(/\b(fill|stroke)="([^"]+)"/g, (m, attr, value) => {
    const v = value.trim().toLowerCase();
    if (v === "none" || v === "currentcolor" || v === "inherit" || v.startsWith("url(") || v.startsWith("var(")) {
      return m;
    }
    changed = true;
    if (attr === "fill") needRootFill = true;
    else needRootStroke = true;
    return `${attr}="inherit"`;
  });

  // Repair pass: if a descendant uses `fill:inherit` or `stroke:inherit` (or
  // `fill="inherit"` / `stroke="inherit"`), the root must have the matching
  // `currentColor` attribute so inheritance resolves to the host's color.
  // Without this, `stroke:inherit` falls back to the initial value `none`.
  if (/\b(fill\s*:\s*inherit|fill="inherit")/.test(fixedBody)) needRootFill = true;
  if (/\b(stroke\s*:\s*inherit|stroke="inherit")/.test(fixedBody)) needRootStroke = true;

  const headBefore = head;
  if (needRootFill) head = ensureRootAttr(head, "fill");
  if (needRootStroke) head = ensureRootAttr(head, "stroke");
  if (head !== headBefore) changed = true;

  return { changed, out: head + fixedBody };
}

const files = readdirSync(ICON_DIR).filter((f) => f.endsWith(".svg"));
let touched = 0;
const touchedFiles = [];
for (const name of files) {
  const p = join(ICON_DIR, name);
  const src = readFileSync(p, "utf8");
  const { changed, out } = fixSvg(src);
  if (changed) {
    touched++;
    touchedFiles.push(name);
    if (!DRY) writeFileSync(p, out);
  }
}

console.log(
  `${DRY ? "[dry-run] " : ""}scanned ${files.length} icons, ${touched} needed fixes.`
);
for (const f of touchedFiles) console.log(`  - ${f}`);
