#!/usr/bin/env node
/*
 * Content pipeline. Runs on every change to main (see .github/workflows/publish.yml) and can be run
 * locally with `node tools/build-content.mjs`.
 *
 * 1. Keywords: every publication without keywords gets them automatically, from the vocabulary in
 *    data/keywords.json and the paper's metadata on OpenAlex (title, abstract, indexed keywords).
 *    Keywords typed by hand in the panel are always kept.
 * 2. Translations: every text edited in the panel (news, people, home page texts, maintenance screen,
 *    former-member groups, keywords) is translated into the other site languages (en, es, ca), whatever
 *    language it was written in. Translations are stored in data/i18n/<lang>/<collection>.json as
 *    { "source text": "translation" }: an entry is reused while its source text is unchanged, a text that
 *    changes is translated again, and texts that no longer exist are dropped.
 *
 * Options:  --site <dir>   also write the results into a copy of the site that is about to be deployed
 *           --offline      do not call any web service (only reorganises existing data)
 * Env:      GOOGLE_TRANSLATE_API_KEY  use the Google Cloud Translation API instead of the free endpoint
 *           PUBLICATIONS_QUIET_MINUTES  only rewrite data/publications.json in the repository when it has
 *                                       not been edited for this long (default 10), so the panel never
 *                                       finds the file changed under an open editor
 *           PUBLICATIONS_LAST_CHANGE   unix time of the last commit that touched data/publications.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'ca'];
const args = process.argv.slice(2);
const SITE_DIR = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
const OFFLINE = args.includes('--offline') || process.env.CONTENT_OFFLINE === '1';
const QUIET_MIN = Number(process.env.PUBLICATIONS_QUIET_MINUTES ?? 10);
const LAST_CHANGE = Number(process.env.PUBLICATIONS_LAST_CHANGE || 0);
const log = (...a) => console.log(...a);
const warn = msg => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARNING: ${msg}`);

/* ---------- files ---------- */
const raw = {};
const readJSON = (rel, fallback) => {
  const file = join(ROOT, rel);
  if (!existsSync(file)) return fallback;
  raw[rel] = readFileSync(file, 'utf8');
  return JSON.parse(raw[rel]);
};
const stringify = (rel, data) => {
  const text = JSON.stringify(data, null, 2);
  // keep the trailing-newline style of the existing file (the panel saves without one)
  return raw[rel] !== undefined && !raw[rel].endsWith('\n') ? text : text + '\n';
};
const changed = [];
function writeJSON(rel, data, { repo = true } = {}) {
  const text = stringify(rel, data);
  const targets = [];
  if (repo) targets.push(join(ROOT, rel));
  if (SITE_DIR) targets.push(join(SITE_DIR, rel));
  for (const file of targets) {
    const old = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (old === text) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    if (file.startsWith(ROOT) && !(SITE_DIR && file.startsWith(SITE_DIR))) changed.push(rel);
  }
}

/* ---------- text helpers ---------- */
const norm = s => ' ' + String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[‐-―\-_/]+/g, ' ').replace(/[^a-z0-9·' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const hasTerm = (text, term) => text.includes(' ' + norm(term).trim());
const countTerm = (text, term) => text.split(' ' + norm(term).trim()).length - 1;
const titleOf = text => {
  const m = String(text || '').match(/[«"“]\s*(.+?)\s*[»"”«]/);
  return (m ? m[1] : String(text || '').split('.')[0]).replace(/\s+/g, ' ').trim();
};
const doiOf = s => { const m = String(s || '').match(/10\.\d{4,9}\/[^\s"<>?#]+/); return m ? m[0].replace(/[.,;)]+$/, '') : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const titleCase = s => s.replace(/\b\p{L}/gu, (c, i) => (i === 0 ? c.toUpperCase() : c));

/* ---------- language detection (en / es / ca, or 'auto' when unsure) ---------- */
const STOP = {
  en: 'the and of to in is are was were our with for on has have been this that from by at an as it its which their new we will be',
  es: 'el los las del y en con por para una es son fue nuestro nuestra nuestros nuestras han ha sido este esta estos que se al como más sus también muy hoy hemos sobre entre',
  ca: 'el els les del i en amb per una és són va van nostre nostra nostres han ha estat aquest aquesta aquests que es al com més seus també molt avui hem sobre entre dels pel als',
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));
function detectLang(text) {
  const s = String(text || '').toLowerCase();
  const score = { en: 0, es: 0, ca: 0 };
  for (const w of s.match(/[\p{L}·']+/gu) || []) for (const l of LANGS) if (STOPSETS[l].has(w)) score[l]++;
  // spelling only breaks ties between Spanish and Catalan (English texts often quote Catalan names)
  score.ca += 0.5 * ((s.match(/l·l|[àèò]|ç/g) || []).length + (s.match(/\b[dl]['’]\p{L}/gu) || []).length);
  score.es += 0.5 * ((s.match(/[ñ¿¡á]|ción\b|ciones\b/g) || []).length);
  const best = LANGS.reduce((a, b) => (score[b] > score[a] ? b : a), 'en');
  const others = Math.max(...LANGS.filter(l => l !== best).map(l => score[l]));
  // not sure (short or mixed text): let the translation service detect it
  return score[best] >= 2 && score[best] > 1.5 * others ? best : 'auto';
}

/* ---------- web services ---------- */
let failures = 0;
async function getJSON(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.split('?')[0]}`);
  return r.json();
}
async function translateChunk(text, from, to) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (key) {
    const j = await getJSON(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: [text], target: to, format: 'text', ...(from === 'auto' ? {} : { source: from }) }),
    });
    return j.data.translations[0].translatedText;
  }
  const j = await getJSON(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ q: text }),
  });
  return (j[0] || []).map(seg => seg[0]).join('');
}
async function translate(text, from, to) {
  if (OFFLINE || failures >= 5) return null;
  // paragraph by paragraph, so blank-line paragraph breaks survive exactly
  const parts = String(text).split(/(\n\s*\n)/);
  const out = [];
  for (const part of parts) {
    if (!part.trim() || /^\n\s*\n$/.test(part)) { out.push(part); continue; }
    let done = null;
    for (let attempt = 0; attempt < 3 && done === null; attempt++) {
      try { done = await translateChunk(part, from, to); failures = 0; }
      catch (e) { if (attempt === 2) { failures++; warn(`translation ${from}→${to} failed: ${e.message}`); } else await sleep(1500 * (attempt + 1)); }
    }
    if (done === null) return null;
    out.push(done.trim() ? done : part);
    await sleep(120);
  }
  return out.join('');
}
async function openAlex(pub) {
  if (OFFLINE) return null;
  const pick = 'select=title,keywords,topics,abstract_inverted_index';
  const doi = doiOf(pub.link) || doiOf(pub.text);
  try {
    if (doi) return await getJSON(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?${pick}`);
    const title = titleOf(pub.text);
    if (title.length < 12) return null;
    const j = await getJSON(`https://api.openalex.org/works?per-page=3&${pick}&search=${encodeURIComponent(title)}`);
    return (j.results || []).find(w => norm(w.title) === norm(title)) || null;
  } catch (e) { warn(`OpenAlex lookup failed for "${titleOf(pub.text)}": ${e.message}`); return null; }
}
const abstractOf = w => {
  const idx = w && w.abstract_inverted_index; if (!idx) return '';
  const words = [];
  for (const [word, positions] of Object.entries(idx)) for (const p of positions) words[p] = word;
  return words.join(' ');
};

/* ---------- 1. keywords ---------- */
const vocab = (readJSON('data/keywords.json', { keywords: [] }).keywords || []).filter(k => k && k.name);
const canonical = new Map(vocab.map(k => [norm(k.name), k.name]));
const cleanKeyword = k => { const s = String(k || '').replace(/\s+/g, ' ').trim(); return canonical.get(norm(s)) || s; };

async function suggestKeywords(pub) {
  const title = norm(titleOf(pub.text));
  const work = await openAlex(pub);
  const abstract = norm(abstractOf(work));
  const indexed = norm([...(work?.keywords || []).map(k => k.display_name), ...(work?.topics || []).slice(0, 3).map(t => t.display_name)].join(' · '));
  const scored = vocab.map(k => {
    const terms = [k.name, ...(k.match || [])];
    const inTitle = terms.some(t => hasTerm(title, t));
    const inIndexed = terms.some(t => hasTerm(indexed, t));
    const hits = terms.reduce((n, t) => n + countTerm(abstract, t), 0);
    return { name: k.name, score: (inTitle ? 4 : 0) + (inIndexed ? 2 : 0) + Math.min(hits, 3) };
  }).filter(k => k.score >= 2).sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 6).map(k => k.name);
  // nothing in the vocabulary fits well: fall back to the keywords OpenAlex indexed for the paper
  for (const k of (work?.keywords || []).filter(k => (k.score ?? 1) >= 0.4)) {
    if (picked.length >= 3) break;
    const name = cleanKeyword(titleCase(k.display_name));
    if (!picked.some(p => norm(p) === norm(name))) picked.push(name);
  }
  return picked;
}

const pubsDoc = readJSON('data/publications.json', { publications: [] });
let pubsChanged = false;
for (const pub of pubsDoc.publications || []) {
  if (!pub || !pub.text) continue;
  const current = (Array.isArray(pub.keywords) ? pub.keywords : pub.keywords ? [pub.keywords] : []).map(cleanKeyword).filter(Boolean);
  const unique = [...new Map(current.map(k => [norm(k), k])).values()];
  if (unique.length) {
    if (JSON.stringify(unique) !== JSON.stringify(pub.keywords)) { pub.keywords = unique; pubsChanged = true; }
    continue;
  }
  const found = await suggestKeywords(pub);
  if (found.length) { pub.keywords = found; pubsChanged = true; log(`keywords · ${titleOf(pub.text).slice(0, 70)} → ${found.join(', ')}`); }
}
if (pubsChanged) {
  const quiet = !LAST_CHANGE || (Date.now() / 1000 - LAST_CHANGE) >= QUIET_MIN * 60;
  writeJSON('data/publications.json', pubsDoc, { repo: quiet });
  if (!quiet) log(`publications.json was edited less than ${QUIET_MIN} min ago: keywords go live now and are saved to the panel on a later run.`);
}

/* ---------- 2. translations ---------- */
const news = readJSON('data/news.json', { news: [] });
const people = readJSON('data/people.json', { people: [] });
const site = readJSON('data/site.json', {});
const maintenance = readJSON('data/maintenance.json', {});
const former = readJSON('data/former-members.json', { groups: [] });
const LANG_OK = l => LANGS.includes(l) ? l : null;

// units: [collection, sourceText, sourceLanguage]
const units = [];
const add = (collection, lang, ...texts) => { for (const t of texts.flat(Infinity)) if (typeof t === 'string' && t.trim()) units.push([collection, t, lang]); };
for (const n of news.news || []) {
  if (!n || !n.title) continue;
  add('news', LANG_OK(n.lang) || detectLang(`${n.title}\n${n.text || ''}`), n.title, n.text);
}
for (const p of people.people || []) {
  if (!p || !p.name) continue;
  add('people', detectLang(`${p.summary || ''}\n${p.about || ''}`), p.position, p.summary, p.about, p.status);
}
{
  const lines = Array.isArray(site.research_lines) ? site.research_lines : [];
  const siteLang = detectLang([site.hero_title, site.hero_subtitle, ...lines.map(l => `${l.title || ''} ${l.description || ''}`)].join('\n'));
  add('site', siteLang, site.hero_eyebrow, site.hero_title, site.hero_subtitle, lines.map(l => [l.title, l.description, l.tags || []]));
  add('site', detectLang(`${maintenance.title || ''}\n${maintenance.message || ''}`), maintenance.title, maintenance.message);
  add('site', detectLang((former.groups || []).map(g => g.title).join('\n')), (former.groups || []).map(g => g.title));
}
for (const pub of pubsDoc.publications || []) add('keywords', 'auto', pub?.keywords || []);

const collections = ['news', 'people', 'site', 'keywords'];
let translatedCount = 0, pending = 0;
for (const lang of LANGS) {
  for (const col of collections) {
    const rel = `data/i18n/${lang}/${col}.json`;
    const old = readJSON(rel, {});
    const memory = {};
    for (const [c, text, from] of units) {
      if (c !== col || text in memory) continue;
      if (typeof old[text] === 'string') { memory[text] = old[text]; continue; } // existing (possibly hand-corrected) translation
      if (from === lang) continue;
      const result = await translate(text, from, lang);
      if (result === null) { pending++; continue; }
      memory[text] = result; translatedCount++;
      log(`${lang} · ${col} · ${text.slice(0, 60).replace(/\s+/g, ' ')}${text.length > 60 ? '…' : ''}`);
    }
    writeJSON(rel, memory);
  }
}

log(`Done: ${translatedCount} new translation(s), ${pending} pending${changed.length ? `; updated ${[...new Set(changed)].join(', ')}` : ''}.`);
if (pending && !OFFLINE) warn(`${pending} text(s) could not be translated now; the site shows the original text until the next run.`);
