// Draws the live stat cards from public GitHub data. Runs daily in .github/workflows/profile.yml.
// Usage: GITHUB_TOKEN=... node scripts/build-stats.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { C, esc, svg, cardBg, icon, tile } from './kit.mjs';

const LOGIN = process.env.PROFILE_USER || 'furnero';
const OUT = process.argv[2] || 'dist';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is not set');

const query = `query($login:String!){ user(login:$login){
  followers{totalCount}
  repositories(ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, first:100){ totalCount nodes{ stargazerCount
    languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } } }
  pullRequests{totalCount} issues{totalCount}
  contributionsCollection{ totalCommitContributions restrictedContributionsCount
    contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } } } }`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'furnero-profile-stats' },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(`GitHub API: ${res.status} ${JSON.stringify(json.errors || json)}`);
const u = json.data.user;

// ---------- numbers ----------
const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));
const total = u.contributionsCollection.contributionCalendar.totalContributions;
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++;
  else if (i === days.length - 1) continue; // today may still be empty
  else break;
}
const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
const langs = {};
for (const r of u.repositories.nodes) for (const e of r.languages.edges) {
  langs[e.node.name] ??= { size: 0, color: e.node.color || C.muted };
  langs[e.node.name].size += e.size;
}
const langList = Object.entries(langs).sort((a, b) => b[1].size - a[1].size);
const langTotal = langList.reduce((s, [, v]) => s + v.size, 0) || 1;
const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
const updated = new Date().toISOString().slice(0, 10);

const head = (x, y, title, iconName, color = C.fox) =>
  tile(x, y, 30, iconName, color) + `<text x="${x + 42}" y="${y + 20}" class="h">${esc(title)}</text>`;
const baseCss = `.h{font:700 13px M7,monospace;fill:${C.muted};letter-spacing:1.2px}.v{font:700 24px G7,sans-serif;fill:${C.text}}` +
  `.k{font:400 12px M4,monospace;fill:${C.muted}}.f{font:400 10.5px M4,monospace;fill:${C.dim}}` +
  `.in{opacity:0;animation:in .6s ease-out forwards}@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`;

// ---------- stats card ----------
function statsCard() {
  const W = 412, H = 212;
  const items = [
    ['Contributions (1y)', fmt(total), 'activity'],
    ['Commits (1y)', fmt(u.contributionsCollection.totalCommitContributions), 'git-commit-horizontal'],
    ['Pull requests', fmt(u.pullRequests.totalCount), 'git-pull-request'],
    ['Issues', fmt(u.issues.totalCount), 'circle-dot'],
    ['Stars earned', fmt(stars), 'star'],
    ['Public repos', fmt(u.repositories.totalCount), 'book-marked'],
  ];
  const body = cardBg(W, H, 'st') + head(22, 18, 'GITHUB STATS', 'code') +
    items.map(([k, v, ic], i) => {
      const x = 22 + (i % 2) * 196, y = 70 + Math.floor(i / 2) * 44;
      return `<g class="in" style="animation-delay:${i * 0.08}s">${icon(ic, x, y + 4, 18, i % 2 ? C.violet : C.fox)}<text x="${x + 28}" y="${y + 19}" class="v" style="font-size:20px">${v}</text><text x="${x + 28}" y="${y + 35}" class="k">${esc(k)}</text></g>`;
    }).join('') + `<text x="${W - 22}" y="38" class="f" text-anchor="end">updated ${updated}</text>`;
  return svg(W, H, { title: `GitHub stats: ${total} contributions in the last year`, fonts: ['G7', 'M4', 'M7'], css: baseCss }, body);
}

// ---------- streak card ----------
function streakCard() {
  const W = 412, H = 212, cx = W / 2, cy = 116, r = 46, circ = 2 * Math.PI * r;
  const frac = Math.min(1, current / Math.max(longest, 1));
  const css = baseCss + `.big{font:700 34px G7,sans-serif;fill:${C.text}}.ring{stroke-dasharray:${circ.toFixed(1)};stroke-dashoffset:${circ.toFixed(1)};animation:draw 1.4s ease-out .2s forwards}` +
    `@keyframes draw{to{stroke-dashoffset:${(circ * (1 - frac)).toFixed(1)}}}.fl{transform-origin:${cx}px ${cy - r}px;animation:fl 1.6s ease-in-out infinite}@keyframes fl{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`;
  const side = (x, val, label) => `<g class="in"><text x="${x}" y="${cy + 4}" class="v" text-anchor="middle">${fmt(val)}</text><text x="${x}" y="${cy + 24}" class="k" text-anchor="middle">${esc(label)}</text></g>`;
  const defs = `<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.fox}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>`;
  const body = cardBg(W, H, 'sk') + head(22, 18, 'STREAK', 'flame') +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="7"/>` +
    `<circle class="ring" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="7" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>` +
    `<g class="fl">${icon('flame', cx - 11, cy - r - 13, 22, C.fox)}</g>` +
    `<text x="${cx}" y="${cy + 12}" class="big" text-anchor="middle">${current}</text><text x="${cx}" y="${cy + r + 26}" class="k" text-anchor="middle">current streak (days)</text>` +
    side(70, total, 'total (1y)') + side(W - 70, longest, 'longest streak') +
    `<text x="${W - 22}" y="38" class="f" text-anchor="end">updated ${updated}</text>`;
  return svg(W, H, { title: `Current streak ${current} days, longest ${longest} days`, fonts: ['G7', 'M4', 'M7'], css, defs }, body);
}

// ---------- languages card ----------
function langCard() {
  const W = 840, H = 170, top = langList.slice(0, 8), bw = W - 44;
  let x = 22, bar = '';
  top.forEach(([name, v], i) => {
    const w = Math.max(3, (v.size / langTotal) * bw);
    bar += `<rect x="${x.toFixed(1)}" y="66" width="${w.toFixed(1)}" height="12" fill="${v.color}"><animate attributeName="width" from="0" to="${w.toFixed(1)}" dur=".9s" begin="${(i * 0.07).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1" keyTimes="0;1"/></rect>`;
    x += w;
  });
  const legend = top.map(([name, v], i) => {
    const lx = 22 + (i % 4) * 202, ly = 112 + Math.floor(i / 4) * 28;
    return `<g class="in" style="animation-delay:${0.3 + i * 0.06}s"><rect x="${lx}" y="${ly - 10}" width="10" height="10" rx="3" fill="${v.color}"/><text x="${lx + 18}" y="${ly}" class="k" style="fill:${C.text}">${esc(name)}</text><text x="${lx + 180}" y="${ly}" class="k" text-anchor="end">${((v.size / langTotal) * 100).toFixed(1)}%</text></g>`;
  }).join('');
  const body = cardBg(W, H, 'lg', C.violet) + head(22, 18, 'LANGUAGES  ·  PUBLIC REPOS, BY CODE SIZE', 'code', C.violet) +
    `<clipPath id="bc"><rect x="22" y="66" width="${bw}" height="12" rx="6"/></clipPath><rect x="22" y="66" width="${bw}" height="12" rx="6" fill="${C.panel2}"/><g clip-path="url(#bc)">${bar}</g>` + legend;
  return svg(W, H, { title: `Top languages: ${top.map(([n]) => n).join(', ')}`, fonts: ['M4', 'M7'], css: baseCss }, body);
}

// ---------- activity chart (contributions per week, last 12 months) ----------
function activityCard() {
  const W = 840, H = 250, L = 52, R = W - 24, T = 74, B = H - 46;
  const weeks = u.contributionsCollection.contributionCalendar.weeks.slice(-52).map((w) => ({
    date: w.contributionDays[0].date, n: w.contributionDays.reduce((s, d) => s + d.contributionCount, 0) }));
  const max = Math.max(4, ...weeks.map((w) => w.n)), step = Math.ceil(max / 4), yMax = step * 4;
  const slot = (R - L) / weeks.length, bw = Math.max(3, slot - 4);
  const py = (v) => B - (v / yMax) * (B - T);
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const y = py(g * step);
    grid += `<line x1="${L}" x2="${R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.line}" stroke-dasharray="${g ? '3 5' : ''}"/><text x="${L - 10}" y="${(y + 4).toFixed(1)}" class="f" text-anchor="end">${g * step}</text>`;
  }
  const bars = weeks.map((w, i) => {
    const x = L + i * slot + (slot - bw) / 2, h = Math.max(w.n ? 4 : 2, B - py(w.n));
    const fill = w.n ? 'url(#bf)' : C.panel2;
    return `<rect x="${x.toFixed(1)}" y="${(B - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}" class="bar" style="animation-delay:${(i * 0.015).toFixed(3)}s"/>`;
  }).join('');
  let labels = '', lastMonth = '';
  weeks.forEach((w, i) => {
    const m = w.date.slice(5, 7);
    if (m !== lastMonth && i > 0) labels += `<text x="${(L + i * slot).toFixed(1)}" y="${B + 20}" class="f">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]}</text>`;
    lastMonth = m;
  });
  const best = weeks.reduce((m, w, i) => (w.n > weeks[m].n ? i : m), 0);
  const css = baseCss + `.bar{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:grow .7s cubic-bezier(.2,.8,.2,1) forwards}@keyframes grow{to{transform:scaleY(1)}}` +
    `.pk{animation:pk 1.8s ease-in-out infinite}@keyframes pk{0%,100%{opacity:.25}50%{opacity:.9}}`;
  const defs = `<linearGradient id="bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.fox2}"/><stop offset="1" stop-color="${C.fox}" stop-opacity=".55"/></linearGradient>`;
  const bx = L + best * slot + slot / 2;
  const body = cardBg(W, H, 'ac') + head(22, 18, 'CONTRIBUTIONS  ·  PER WEEK, LAST 12 MONTHS', 'activity') +
    `<text x="${W - 22}" y="38" class="k" text-anchor="end"><tspan style="fill:${C.text}">${total}</tspan> contributions</text>` +
    grid + bars + labels +
    (weeks[best].n ? `<circle class="pk" cx="${bx.toFixed(1)}" cy="${(py(weeks[best].n) - 12).toFixed(1)}" r="5" fill="${C.fox}"/>` : '');
  return svg(W, H, { title: `${total} contributions in the last 12 months`, fonts: ['M4', 'M7'], css, defs }, body);
}

mkdirSync(OUT, { recursive: true });
const files = { 'stats.svg': statsCard(), 'streak.svg': streakCard(), 'languages.svg': langCard(), 'activity.svg': activityCard() };
for (const [f, s] of Object.entries(files)) { writeFileSync(join(OUT, f), s); console.log('wrote', join(OUT, f)); }
console.log({ total, current, longest, stars, repos: u.repositories.totalCount, langs: langList.slice(0, 5).map(([n]) => n) });
