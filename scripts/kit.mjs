// Shared look for every generated SVG: palette, embedded fonts, small helpers.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const C = {
  bg: '#0b0e14',
  panel: '#10141d',
  panel2: '#161b27',
  line: '#242c3d',
  text: '#e8edf5',
  muted: '#8892a6',
  dim: '#4b5468',
  fox: '#ff8a3d',
  fox2: '#ffb46b',
  violet: '#a78bfa',
  teal: '#5eead4',
};

// Font families used inside the SVGs (subset woff2, embedded as data URIs).
const FONTS = {
  G7: ['grotesk-700.woff2', 700],
  G5: ['grotesk-500.woff2', 500],
  M4: ['mono-400.woff2', 400],
  M7: ['mono-700.woff2', 700],
};
const fontCache = {};
export function fontCss(...names) {
  return names.map((n) => {
    if (!fontCache[n]) fontCache[n] = readFileSync(join(here, 'fonts', FONTS[n][0])).toString('base64');
    return `@font-face{font-family:${n};src:url(data:font/woff2;base64,${fontCache[n]}) format('woff2');font-weight:${FONTS[n][1]}}`;
  }).join('');
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function svg(w, h, { title, fonts = [], css = '', defs = '' }, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">` +
    `<title>${esc(title)}</title>` +
    `<style>${fontCss(...fonts)}${css}</style>` +
    (defs ? `<defs>${defs}</defs>` : '') +
    body + `</svg>\n`;
}

// Card background: dark panel, hairline border, faint top glow in the accent colour.
export function cardBg(w, h, id, accent = C.fox) {
  return `<defs><linearGradient id="${id}-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".10"/><stop offset=".55" stop-color="${accent}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset=".5" stop-color="${accent}" stop-opacity=".9"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="${C.panel}" stroke="${C.line}"/>` +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="url(#${id}-glow)"/>` +
    `<rect x="24" y="0" width="${w - 48}" height="1.5" fill="url(#${id}-edge)"/>`;
}

// A Lucide icon (inner markup from icons.json) placed as a nested 24x24 viewBox.
let iconSet;
export function icon(name, x, y, size, color) {
  iconSet ??= JSON.parse(readFileSync(join(here, 'icons.json'), 'utf8'));
  const inner = iconSet[name];
  if (!inner) throw new Error(`icon ${name} missing from icons.json`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" color="${color}">${inner}</svg>`;
}

// Square icon tile used for section headers and small badges.
export function tile(x, y, size, iconName, color = C.fox) {
  const pad = size * 0.24;
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${size - 1}" height="${size - 1}" rx="${size * 0.26}" fill="${C.panel2}" stroke="${C.line}"/>` +
    icon(iconName, x + pad, y + pad, size - pad * 2, color);
}
