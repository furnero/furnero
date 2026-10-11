// Builds every static SVG in assets/. Needs network once (icons); run: node scripts/build-assets.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, esc, svg, cardBg, icon, tile } from './kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); console.log('wrote', p, `${(s.length / 1024).toFixed(1)} KB`); };

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'furnero-profile-build' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

// ---------- icons ----------
const LUCIDE = ['user-round', 'id-card', 'boxes', 'layers', 'activity', 'at-sign', 'heart', 'globe', 'server', 'mail',
  'gamepad-2', 'arrow-up-right', 'git-commit-horizontal', 'git-pull-request', 'circle-dot', 'star', 'users', 'flame',
  'trophy', 'calendar', 'book-marked', 'code', 'bug'];
const icons = {};
for (const n of LUCIDE) {
  const s = await get(`https://api.iconify.design/lucide/${n}.svg`);
  icons[n] = s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>'));
}
writeFileSync(join(root, 'scripts/icons.json'), JSON.stringify(icons));

let uid = 0;
function nest(src, x, y, size) {
  const p = `i${uid++}-`;
  const open = src.match(/<svg[^>]*>/)[0];
  const vb = (open.match(/viewBox="([^"]+)"/) || [, '0 0 256 256'])[1];
  let inner = src.slice(src.indexOf(open) + open.length, src.lastIndexOf('</svg>'));
  inner = inner.replace(/<title>.*?<\/title>/g, '')
    .replace(/id="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${p}$1"`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${inner}</svg>`;
}

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const mix = (a, b, t) => '#' + [0, 1, 2].map((i) => { const x = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16), y = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16); return Math.round(x + (y - x) * t).toString(16).padStart(2, '0'); }).join('');
async function brand(slug) {
  const s = await get(`https://cdn.simpleicons.org/${slug}`);
  const d = [...s.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  const fill = (s.match(/fill="(#[0-9a-fA-F]{6})"/) || [, '#e8edf5'])[1];
  return { d, color: lum(fill) < 0.22 ? C.text : Math.max(...[1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16))) < 150 ? mix(fill, '#ffffff', 0.45) : fill };
}
// skillicons look-alike tile for brands skillicons does not ship
function brandTile(b, x, y, size) {
  const g = size * 0.58, o = (size - g) / 2;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 256 256"><rect width="256" height="256" rx="60" fill="#242938"/></svg>` +
    `<svg x="${x + o}" y="${y + o}" width="${g}" height="${g}" viewBox="0 0 24 24">${b.d.map((d) => `<path d="${d}" fill="${b.color}"/>`).join('')}</svg>`;
}
async function stackIcon(id, x, y, size) {
  if (id.startsWith('si:')) return brandTile(await brand(id.slice(3)), x, y, size);
  return nest(await get(`https://skillicons.dev/icons?i=${id}&theme=dark`), x, y, size);
}

// ---------- header ----------
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function header() {
  const W = 1200, H = 360, r = rng(7);
  let stars = '';
  for (let i = 0; i < 80; i++) {
    const x = (r() * W).toFixed(1), y = (r() * H).toFixed(1), s = (0.5 + r() * 1.3).toFixed(2);
    stars += `<circle class="tw" cx="${x}" cy="${y}" r="${s}" fill="${r() > 0.8 ? C.fox2 : '#cfd7ff'}" style="animation-delay:-${(r() * 6).toFixed(2)}s;animation-duration:${(3 + r() * 4).toFixed(2)}s"/>`;
  }

  // typing line: one shared clip whose width steps char by char, one text per line shown in its slot
  const lines = ['builds websites & community sites', 'writes Discord bots (Pangobot)', 'makes cursed Minecraft mods', 'grows a homelab that is NOT too big', 'staff at Eurofurence', 'hunts bugs at PawHost'];
  const CH = 22 * 0.6, X0 = 92, SLOT = 4.6, T = SLOT * lines.length;
  const ev = [];
  lines.forEach((l, i) => {
    const s = i * SLOT, n = l.length;
    for (let c = 0; c <= n; c++) ev.push([s + (c / n) * 1.4, c]);
    for (let c = n - 1; c >= 0; c--) ev.push([s + 3.7 + ((n - 1 - c) / n) * 0.5, c]);
  });
  ev.unshift([0, 0]); ev.push([T, 0]);
  const keyTimes = ev.map((e) => (e[0] / T).toFixed(5)).join(';');
  const widths = ev.map((e) => (e[1] * CH).toFixed(1)).join(';');
  const curX = ev.map((e) => (X0 + e[1] * CH + 2).toFixed(1)).join(';');
  const texts = lines.map((l, i) => {
    const a = (i * SLOT) / T, b = ((i + 1) * SLOT) / T;
    const kt = i === 0 ? `0;${b.toFixed(5)};1` : `0;${a.toFixed(5)};${b.toFixed(5)};1`;
    const vals = i === 0 ? '1;0;0' : '0;1;0;0';
    return `<text x="${X0}" y="262" class="m" fill="${C.text}" opacity="${i === 0 ? 1 : 0}">${esc(l)}<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${vals}"/></text>`;
  }).join('');

  const chips = ['EST. 2006', 'FURRY SINCE 2019', 'EUROFURENCE STAFF', 'BUG HUNTER @ PAWHOST'];
  let cx = 60, chipSvg = '';
  for (const c of chips) {
    const w = c.length * 12 * 0.6 + 26;
    chipSvg += `<rect x="${cx}" y="292" width="${w}" height="26" rx="13" fill="${C.panel2}" stroke="${C.line}"/><circle cx="${cx + 12}" cy="305" r="3" fill="${C.fox}"/><text x="${cx + 20}" y="309.5" class="chip">${esc(c)}</text>`;
    cx += w + 10;
  }

  // low-poly fox head, centred around (1000,180)
  const P = (pts, f, o = 1) => `<polygon points="${pts}" fill="${f}" opacity="${o}"/>`;
  const fox = `<g transform="translate(1000 182) scale(1.25) translate(-1000 -182)">` +
    P('945,100 990,150 958,168', C.fox) + P('950,112 980,150 962,160', '#2a1a12') +
    P('1055,100 1010,150 1042,168', '#e2742c') + P('1050,112 1020,150 1038,160', '#2a1a12') +
    P('958,168 1000,146 1000,196', C.fox) + P('1042,168 1000,146 1000,196', '#e2742c') +
    P('958,168 1000,196 972,214', '#ff9f5c') + P('1042,168 1000,196 1028,214', '#ef7f33') +
    P('958,168 972,214 940,200', '#f4ece4') + P('1042,168 1028,214 1060,200', '#e3d8ce') +
    P('972,214 1000,196 1000,252', '#f4ece4') + P('1028,214 1000,196 1000,252', '#e3d8ce') +
    P('991,240 1009,240 1000,252', '#1b1210') +
    P('972,184 990,190 976,193', '#1b1210') + P('1028,184 1010,190 1024,193', '#1b1210') + `</g>`;
  const orbit = (rx, ry, dur, dir, dots) =>
    `<g><animateTransform attributeName="transform" type="rotate" from="0 1000 182" to="${dir * 360} 1000 182" dur="${dur}s" repeatCount="indefinite"/>` +
    `<ellipse cx="1000" cy="182" rx="${rx}" ry="${ry}" fill="none" stroke="${C.line}" stroke-dasharray="3 7"/>` +
    dots.map(([a, col, s]) => `<circle cx="${(1000 + rx * Math.cos(a)).toFixed(1)}" cy="${(182 + ry * Math.sin(a)).toFixed(1)}" r="${s}" fill="${col}"/>`).join('') + `</g>`;

  const css = `.m{font:400 22px M4,monospace}.p{font:400 15px M4,monospace}.chip{font:700 12px M7,monospace;fill:${C.muted};letter-spacing:.5px}` +
    `.name{font:700 118px G7,sans-serif;letter-spacing:-3px}.tw{animation:tw 4s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.15}50%{opacity:.9}}`;
  const defs = `<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" stroke-opacity=".035"/></pattern>` +
    `<radialGradient id="fade" cx=".35" cy=".45" r=".75"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="gm"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>` +
    `<radialGradient id="g1" cx="0" cy="1" r="1"><stop offset="0" stop-color="${C.fox}" stop-opacity=".28"/><stop offset=".6" stop-color="${C.fox}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="g2" cx="1" cy="0" r="1"><stop offset="0" stop-color="${C.violet}" stop-opacity=".25"/><stop offset=".6" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ng" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="700" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="${C.fox}"/><stop offset=".35" stop-color="${C.fox2}"/><stop offset=".7" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.fox}"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="700 0" dur="9s" repeatCount="indefinite"/></linearGradient>` +
    `<filter id="blur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<clipPath id="clip"><rect x="0" y="0" width="${W}" height="${H}" rx="20"/></clipPath>` +
    `<clipPath id="type"><rect x="${X0}" y="236" height="36" width="0"><animate attributeName="width" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${widths}"/></rect></clipPath>`;

  const body = `<g clip-path="url(#clip)"><rect width="${W}" height="${H}" fill="${C.bg}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#grid)" mask="url(#gm)"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>${stars}` +
    orbit(150, 150, 60, 1, [[0.3, C.fox, 4], [2.4, C.violet, 3], [4.4, C.teal, 2.5]]) +
    orbit(205, 120, 90, -1, [[1.1, C.fox2, 3], [3.6, C.violet, 2.5]]) + fox +
    `<text x="60" y="86" class="p"><tspan fill="${C.fox}">furnero</tspan><tspan fill="${C.muted}">@</tspan><tspan fill="${C.violet}">github</tspan><tspan fill="${C.muted}">:~$ </tspan><tspan fill="${C.text}">whoami</tspan></text>` +
    `<text x="56" y="206" class="name" fill="${C.fox}" opacity=".35" filter="url(#blur)">NEROZHEN</text>` +
    `<text x="56" y="206" class="name" fill="url(#ng)">NEROZHEN</text>` +
    `<text x="60" y="262" class="m" fill="${C.fox}">&gt;</text><g clip-path="url(#type)">${texts}</g>` +
    `<rect y="241" width="11" height="26" fill="${C.fox}"><animate attributeName="x" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${curX}"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1s" repeatCount="indefinite"/></rect>` +
    chipSvg + `</g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${C.line}"/>`;
  return svg(W, H, { title: 'Nerozhen - websites, Discord bots, Minecraft mods, homelab', fonts: ['G7', 'M4', 'M7'], css, defs }, body);
}

// ---------- section strips ----------
function section(title, comment, iconName) {
  const W = 840, H = 64;
  const css = `.t{font:700 28px G7,sans-serif;fill:${C.text}}.c{font:400 14px M4,monospace;fill:${C.dim}}`;
  const defs = `<linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${C.fox}"/><stop offset=".35" stop-color="${C.violet}" stop-opacity=".6"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></linearGradient>`;
  const body = tile(0, 6, 46, iconName) +
    `<text x="62" y="40" class="t">${esc(title)}</text>` +
    `<text x="${W}" y="40" class="c" text-anchor="end">// ${esc(comment)}</text>` +
    `<rect x="0" y="61" width="${W}" height="1.5" fill="url(#l)"/>`;
  return svg(W, H, { title, fonts: ['G7', 'M4'], css, defs }, body);
}

// ---------- role cards (small logo + title) ----------
function role(id, logoFile, title, sub, link, accent) {
  const W = 412, H = 104;
  const png = readFileSync(join(root, 'assets/logos', logoFile)).toString('base64');
  const css = `.t{font:700 21px G7,sans-serif;fill:${C.text}}.s{font:400 13px M4,monospace;fill:${C.muted}}.u{font:400 12px M4,monospace;fill:${accent}}`;
  const body = cardBg(W, H, id, accent) +
    `<clipPath id="${id}-c"><circle cx="50" cy="52" r="28"/></clipPath>` +
    `<circle cx="50" cy="52" r="31" fill="none" stroke="${accent}" stroke-opacity=".5"/>` +
    `<image x="22" y="24" width="56" height="56" href="data:image/png;base64,${png}" clip-path="url(#${id}-c)"/>` +
    `<text x="98" y="44" class="t">${esc(title)}</text><text x="98" y="66" class="s">${esc(sub)}</text><text x="98" y="86" class="u">${esc(link)}</text>` +
    icon('arrow-up-right', W - 40, 18, 20, C.muted);
  return svg(W, H, { title: `${title} - ${sub}`, fonts: ['G7', 'M4'], css }, body);
}

// ---------- project cards ----------
function project(id, { title, link, desc, tags, mark, accent = C.fox }) {
  const W = 412, H = 184;
  const css = `.t{font:700 22px G7,sans-serif;fill:${C.text}}.u{font:400 12.5px M4,monospace;fill:${C.muted}}.d{font:500 15px G5,sans-serif;fill:#c3cbd9}.g{font:700 11px M7,monospace;fill:${accent};letter-spacing:.6px}`;
  let tx = 22, tagSvg = '';
  for (const t of tags) {
    const w = t.length * 11 * 0.6 + 18;
    tagSvg += `<rect x="${tx}" y="146" width="${w}" height="22" rx="6" fill="${accent}" fill-opacity=".09" stroke="${accent}" stroke-opacity=".35"/><text x="${tx + 9}" y="161" class="g">${esc(t)}</text>`;
    tx += w + 8;
  }
  const body = cardBg(W, H, id, accent) +
    `<rect x="22.5" y="22.5" width="51" height="51" rx="13" fill="${C.panel2}" stroke="${C.line}"/>${mark}` +
    `<text x="90" y="46" class="t">${esc(title)}</text><text x="90" y="67" class="u">${esc(link)}</text>` +
    desc.map((l, i) => `<text x="22" y="${104 + i * 21}" class="d">${esc(l)}</text>`).join('') + tagSvg +
    icon('arrow-up-right', W - 40, 18, 20, C.muted);
  return svg(W, H, { title: `${title} - ${desc.join(' ')}`, fonts: ['G7', 'G5', 'M4', 'M7'], css }, body);
}

// ---------- stack rows ----------
async function stackRow(label, ids) {
  const W = 840, H = 62, S = 46, GAP = 8, X0 = 186;
  let icons = '';
  for (let i = 0; i < ids.length; i++) icons += await stackIcon(ids[i], X0 + i * (S + GAP), 8, S);
  const css = `.l{font:700 12px M7,monospace;fill:${C.muted};letter-spacing:1.2px}`;
  const body = `<rect x="0" y="27" width="8" height="8" rx="2" fill="${C.fox}"/><text x="18" y="35.5" class="l">${esc(label.toUpperCase())}</text>` +
    `<rect x="150" y="30.5" width="22" height="1" fill="${C.line}"/>` + icons;
  return svg(W, H, { title: `${label}: ${ids.map((i) => i.replace('si:', '')).join(', ')}`, fonts: ['M7'], css }, body);
}

// ---------- social tiles ----------
async function social(slug, label, lucideName) {
  const S = 64;
  let glyph, color = C.fox;
  if (lucideName) glyph = icon(lucideName, 18, 18, 28, C.fox);
  else {
    const b = await brand(slug); color = b.color;
    glyph = `<svg x="19" y="19" width="26" height="26" viewBox="0 0 24 24">${b.d.map((d) => `<path d="${d}" fill="${b.color}"/>`).join('')}</svg>`;
  }
  const body = `<rect x=".5" y=".5" width="${S - 1}" height="${S - 1}" rx="16" fill="${C.panel}" stroke="${C.line}"/>` +
    `<rect x="16" y="${S - 2}" width="${S - 32}" height="2" rx="1" fill="${color}" opacity=".8"/>` + glyph;
  return svg(S, S, { title: label }, body);
}

// ---------- small inline badges (games row) ----------
async function gamesRow(slugs) {
  const W = 840, H = 54, S = 38;
  let x = 186, tiles = '';
  for (const s of slugs) {
    const b = await brand(s);
    tiles += `<rect x="${x + 0.5}" y="8.5" width="${S - 1}" height="${S - 1}" rx="10" fill="${C.panel2}" stroke="${C.line}"/><svg x="${x + 9}" y="17" width="20" height="20" viewBox="0 0 24 24">${b.d.map((d) => `<path d="${d}" fill="${b.color}"/>`).join('')}</svg>`;
    x += S + 8;
  }
  const css = `.l{font:700 12px M7,monospace;fill:${C.muted};letter-spacing:1.2px}`;
  const body = `<rect x="0" y="23" width="8" height="8" rx="2" fill="${C.violet}"/><text x="18" y="31.5" class="l">PLAYS ON</text><rect x="150" y="26.5" width="22" height="1" fill="${C.line}"/>` + tiles;
  return svg(W, H, { title: `Plays on: ${slugs.join(', ')}`, fonts: ['M7'], css }, body);
}

// ---------- support button + footer ----------
async function paypal() {
  const W = 280, H = 56, b = await brand('paypal');
  const css = `.t{font:700 16px G7,sans-serif;fill:${C.text}}.s{font:400 11px M4,monospace;fill:${C.muted}}`;
  const body = cardBg(W, H, 'pp', '#3b82f6') +
    `<svg x="20" y="16" width="24" height="24" viewBox="0 0 24 24">${b.d.map((d) => `<path d="${d}" fill="#5b9bff"/>`).join('')}</svg>` +
    `<text x="58" y="27" class="t">Buy me a coffee</text><text x="58" y="43" class="s">paypal.me/foxnero</text>` + icon('heart', W - 40, 18, 20, C.fox);
  return svg(W, H, { title: 'Support me on PayPal', fonts: ['G7', 'M4'], css }, body);
}

function footer() {
  const W = 1200, H = 130;
  const wave = (y, amp, op, dur, col) => {
    const d = `M0 ${y} ` + Array.from({ length: 7 }, (_, i) => `Q ${i * 400 + 100} ${y - amp} ${i * 400 + 200} ${y} T ${i * 400 + 400} ${y}`).join(' ') + ` V ${H} H 0 Z`;
    return `<path d="${d}" fill="${col}" opacity="${op}"><animateTransform attributeName="transform" type="translate" from="0 0" to="-400 0" dur="${dur}s" repeatCount="indefinite"/></path>`;
  };
  const css = `.f{font:400 15px M4,monospace;fill:${C.muted}}`;
  const body = `<clipPath id="fc"><rect width="${W}" height="${H}" rx="20"/></clipPath><g clip-path="url(#fc)">` +
    wave(70, 18, 0.18, 14, C.violet) + wave(84, 14, 0.22, 10, C.fox) + wave(98, 10, 0.9, 18, C.panel) +
    `<text x="${W / 2}" y="121" class="f" text-anchor="middle">built from way too many hand-made SVGs  ·  rawr~ :3</text></g>`;
  return svg(W, H, { title: 'Footer', fonts: ['M4'], css }, body);
}

// ---------- build ----------
out('assets/header.svg', header());

const SECTIONS = [
  ['about', 'About', 'whoami --verbose', 'user-round'],
  ['roles', 'Roles', 'where you can find me', 'id-card'],
  ['projects', 'Projects', 'stuff I build', 'boxes'],
  ['stack', 'Tech Stack', 'tools of the trade', 'layers'],
  ['stats', 'Activity', 'regenerated daily by a GitHub Action', 'activity'],
  ['socials', 'Socials', 'say hi', 'at-sign'],
  ['support', 'Support', 'if you want to', 'heart'],
];
for (const [f, t, c, i] of SECTIONS) out(`assets/sections/${f}.svg`, section(t, c, i));

out('assets/roles/eurofurence.svg', role('ef', 'eurofurence.png', 'Eurofurence Staff', 'Marketing · Fursuit Support · Discord', 'eurofurence.org', C.teal));
out('assets/roles/pawhost.svg', role('ph', 'pawhost.png', 'Bug Hunter', 'at PawHost · finding what breaks', 'pawhost.de', C.fox));

const pangoMark = (() => {
  const s = readFileSync(join(root, 'assets/logos/pangobot.svg'), 'utf8');
  return nest(s, 28, 28, 40);
})();
const cf = await brand('curseforge');
const glyph = (b, x, y, s, col) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24">${b.d.map((d) => `<path d="${d}" fill="${col || b.color}"/>`).join('')}</svg>`;
out('assets/projects/pangobot.svg', project('pb', { title: 'Pangobot', link: 'pangobot.net', desc: ['Modular Discord bot with its own web', 'dashboard, docs and status page.'], tags: ['DISCORD.JS', 'FASTIFY', 'SQLITE'], mark: pangoMark }));
out('assets/projects/minecraft.svg', project('mc', { title: 'Minecraft Mods', link: 'curseforge.com/members/nerozhen', desc: ['Horror, chaos and other cursed ideas', 'for NeoForge and Fabric.'], tags: ['JAVA', 'NEOFORGE', 'FABRIC'], mark: glyph(cf, 33, 33, 30), accent: '#f16436' }));
out('assets/projects/websites.svg', project('ws', { title: 'Websites', link: 'nerozhen.de', desc: ['Portfolios and community sites,', 'designed, built and self-hosted.'], tags: ['ASTRO', 'NUXT', 'NGINX'], mark: icon('globe', 33, 33, 30, C.violet), accent: C.violet }));
out('assets/projects/homelab.svg', project('hl', { title: 'Homelab', link: 'github.com/furnero/linux-scripts', desc: ['Self-hosted everything, WireGuard,', 'Docker and too many dashboards.'], tags: ['DEBIAN', 'DOCKER', 'GRAFANA'], mark: icon('server', 33, 33, 30, C.teal), accent: C.teal }));

const STACK = [
  ['stack-languages', 'Languages', ['cs', 'java', 'js', 'lua', 'php', 'py', 'bash']],
  ['stack-web', 'Web & Backend', ['nodejs', 'discordjs', 'si:fastify', 'electron', 'angular', 'astro', 'nuxtjs', 'vite', 'flask', 'npm']],
  ['stack-data', 'Databases', ['mysql', 'si:mariadb', 'postgres', 'sqlite', 'redis', 'si:influxdb', 'firebase']],
  ['stack-infra', 'Infra & Homelab', ['docker', 'debian', 'linux', 'nginx', 'si:apache', 'cloudflare', 'si:wireguard', 'si:tailscale', 'grafana', 'si:homeassistant', 'si:pihole', 'raspberrypi']],
  ['stack-tools', 'Tools & Creative', ['git', 'github', 'godot', 'cmake', 'selenium', 'si:ffmpeg', 'si:gimp', 'pr', 'si:bitwarden', 'si:tampermonkey', 'si:prettier']],
];
for (const [f, l, ids] of STACK) out(`assets/stack/${f}.svg`, await stackRow(l, ids));

const games = [];
for (const g of ['steam', 'playstation', 'xbox', 'battledotnet', 'epicgames', 'ubisoft']) {
  try { await brand(g); games.push(g); } catch { console.log('skip game icon', g); }
}
out('assets/stack/games.svg', await gamesRow(games));

const SOCIALS = [['discord', 'Discord'], ['instagram', 'Instagram'], ['twitch', 'Twitch'], ['x', 'X'], ['youtube', 'YouTube'], ['curseforge', 'CurseForge'], ['mail', 'Email', 'mail'], ['web', 'nerozhen.de', 'globe']];
for (const [s, l, lu] of SOCIALS) out(`assets/socials/${s}.svg`, await social(s, l, lu));

out('assets/support/paypal.svg', await paypal());
out('assets/footer.svg', footer());
