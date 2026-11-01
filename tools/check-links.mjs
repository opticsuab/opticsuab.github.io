#!/usr/bin/env node
/* Checks every external link of the site's content (news, people, publications, theses, patents, master theses
   and the long pages in data/pages.json and their translations) and reports the ones that are broken.
     node tools/check-links.mjs [--report report.md]
   Run monthly and on demand by .github/workflows/check-links.yml, which opens an issue with the broken ones.
   Sites that block automated checks (403, 429…) are listed apart as "could not check", not as broken. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const REPORT = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;
const read = rel => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

/* ---------- collect: url → places where it appears ---------- */
const links = new Map();
const add = (url, where) => {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return;
  url = url.replace(/&amp;/g, '&');
  if (!links.has(url)) links.set(url, new Set());
  links.get(url).add(where);
};
const short = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 70);
for (const n of read('data/news.json').news || []) add(n.link, `Noticia «${short(n.title)}»`);
for (const p of read('data/people.json').people || []) for (const k of ['scholar', 'orcid', 'scopus', 'wos', 'researcherid', 'linkedin', 'web']) add(p[k], `Persona ${p.name} (${k})`);
for (const [file, key, label] of [['publications', 'publications', 'Publicación'], ['theses', 'theses', 'Tesis'], ['patents', 'patents', 'Patente'], ['master-theses', 'master_theses', 'Trabajo de máster']]) {
  for (const r of read(`data/${file}.json`)[key] || []) add(r.link, `${label} ${r.year} «${short(r.short_title || r.text)}»`);
}
const pageFiles = ['data/pages.json', ...['es', 'ca'].map(l => `data/i18n/${l}/pages.json`).filter(f => existsSync(join(ROOT, f)))];
for (const f of pageFiles) for (const [k, html] of Object.entries(read(f))) for (const m of String(html).matchAll(/href="([^"]+)"/g)) add(m[1], `Página larga «${k}» (${f.includes('/es/') ? 'es' : f.includes('/ca/') ? 'ca' : 'en'})`);

/* ---------- check ---------- */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'en,es;q=0.8' } });
      if (method === 'GET') r.body?.cancel().catch(() => {});
      if (r.ok) return { status: r.status, final: r.url };
      if (method === 'HEAD' && [400, 403, 404, 405, 406, 429, 500, 501, 503].includes(r.status)) continue; /* some servers reject HEAD */
      return { status: r.status, final: r.url };
    } catch (e) {
      if (method === 'GET') return { status: 0, error: e.cause?.code || e.name || String(e) };
    }
  }
  return { status: 0, error: 'unknown' };
}
const classify = r => {
  if (r.status >= 200 && r.status < 400) return 'ok';
  if ([401, 403, 418, 429, 999].includes(r.status) || (r.status === 0 && /TIMEOUT|Timeout|ABORT/i.test(r.error || ''))) return 'blocked';
  return 'broken';
};
const urls = [...links.keys()];
const results = new Map();
let i = 0;
async function worker() {
  while (i < urls.length) {
    const url = urls[i++];
    let r = await probe(url);
    if (classify(r) !== 'ok') { await new Promise(res => setTimeout(res, 3000)); r = await probe(url); } /* one retry */
    results.set(url, r);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const group = k => urls.filter(u => classify(results.get(u)) === k);
const broken = group('broken'), blocked = group('blocked');
const line = u => { const r = results.get(u); return `- ${u} — **${r.status || r.error}**\n  - ${[...links.get(u)].join('\n  - ')}`; };
const report = `# Enlaces de la web: ${broken.length} roto(s)

Comprobados ${urls.length} enlaces externos el ${new Date().toISOString().slice(0, 10)}.

## Rotos (${broken.length})
${broken.length ? broken.map(line).join('\n') : 'Ninguno.'}

## No se pudieron comprobar (${blocked.length})
Webs que bloquean las comprobaciones automáticas o no respondieron a tiempo. Suelen funcionar en un navegador.
${blocked.length ? blocked.map(line).join('\n') : 'Ninguna.'}

Cómo corregir: los enlaces de noticias, personas, publicaciones, tesis, patentes y másteres se cambian en el panel; los de las páginas largas, en \`data/pages.json\` y sus traducciones.
`;
if (REPORT) writeFileSync(REPORT, report);
console.log(report);
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `broken=${broken.length}\n`, { flag: 'a' });

