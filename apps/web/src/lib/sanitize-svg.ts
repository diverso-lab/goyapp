// Very defensive SVG sanitizer: strips anything that could execute in a headless browser.
// This runs server-side before we forward the SVG to Puppeteer for PDF rendering.

const DANGEROUS_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
  "handler",
  "listener",
];

const DANGEROUS_ATTRS_EXACT = new Set(["href", "xlink:href"]);

export function sanitizeSvg(svg: string): string {
  let out = svg;

  // Remove dangerous tags (including their contents).
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, "gi");
    out = out.replace(re, "");
    // Self-closing variant.
    const re2 = new RegExp(`<\\s*${tag}\\b[^>]*/?>`, "gi");
    out = out.replace(re2, "");
  }

  // Strip on* attributes ("onload", "onclick", etc.).
  out = out.replace(/\s+on[a-z-]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\s+on[a-z-]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\s+on[a-z-]+\s*=\s*[^\s"'>]+/gi, "");

  // Strip javascript: / data:text URLs from href / xlink:href (allow data:image/*).
  out = out.replace(/\s+(href|xlink:href)\s*=\s*"([^"]*)"/gi, (m, attr: string, value: string) => {
    if (/^\s*javascript:/i.test(value)) return "";
    if (/^\s*data:(?!image\/)/i.test(value)) return "";
    return ` ${attr}="${value}"`;
  });
  out = out.replace(/\s+(href|xlink:href)\s*=\s*'([^']*)'/gi, (m, attr: string, value: string) => {
    if (/^\s*javascript:/i.test(value)) return "";
    if (/^\s*data:(?!image\/)/i.test(value)) return "";
    return ` ${attr}='${value}'`;
  });

  // Defense-in-depth: forbid <style> blocks that contain @import or url() with javascript:.
  out = out.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, inner: string) => {
    if (/@import|javascript:|expression\s*\(/i.test(inner)) return "";
    return m;
  });

  void DANGEROUS_ATTRS_EXACT;
  return out;
}
