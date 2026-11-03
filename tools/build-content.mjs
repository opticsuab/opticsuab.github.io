#!/usr/bin/env node
/*
 * Content pipeline. Runs on every change to main (see .github/workflows/publish.yml) and can be run
 * locally with `node tools/build-content.mjs`.
 *
 * 0. Publications: an entry with only a DOI (or arXiv id) and its title gets the full reference, year and link
 *    from the DOI's metadata (Crossref, or DataCite for arXiv), in the site's format. The title written in the
 *    panel is checked against the DOI's: if they do not match, the entry is held back (only shown with ?preview,
 *    with a note). A reference written by hand in the panel always wins.
 * 1. Keywords: every publication gets keywords automatically from the keyword bank and the paper's
 *    metadata on OpenAlex (title, abstract, indexed keywords); new terms join the bank. Keywords set in
 *    data/publication-keywords.json always win (see the keywords section below).
 * 2. Translations: every text edited in the panel (news, people, home page texts, maintenance screen,
 *    former-member groups, keywords) is translated into the other site languages (en, es, ca), whatever
 *    language it was written in. Translations are stored in data/i18n/<lang>/<collection>.json as
 *    { "source text": "translation" }: an entry is reused while its source text is unchanged, a text that
 *    changes is translated again, and texts that no longer exist are dropped. Translations committed to
 *    the repository (e.g. corrected by hand) take precedence over generated ones. Terms listed in
 *    data/glossary.json (institutions, programmes…) are kept exactly as written in every language.
 *
 * Options:  --site <dir>   write the results into the copy of the site that is about to be deployed
 *           --cache <dir>  keep generated content in this folder (the "generated" branch) instead of the
 *                          repository files, which are then left untouched
 *           --offline      do not call any web service (only reorganises existing data)
 * Env:      GOOGLE_TRANSLATE_API_KEY  use the Google Cloud Translation API instead of the free endpoint
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'ca'];
const args = process.argv.slice(2);
const SITE_DIR = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
const CACHE_DIR = args.includes('--cache') ? args[args.indexOf('--cache') + 1] : null;
const OFFLINE = args.includes('--offline') || process.env.CONTENT_OFFLINE === '1';
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
const readCache = (rel, fallback) => {
  const file = CACHE_DIR && join(CACHE_DIR, rel);
  return file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
};
const changed = [];
// generated content goes to the cache folder when there is one, otherwise to the repository
function writeJSON(rel, data, { stored = true } = {}) {
  const text = stringify(rel, data);
  const targets = [];
  if (stored) targets.push(CACHE_DIR ? join(CACHE_DIR, rel) : join(ROOT, rel));
  if (SITE_DIR) targets.push(join(SITE_DIR, rel));
  for (const file of targets) {
    const old = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (old === text) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    if (!(SITE_DIR && file.startsWith(SITE_DIR))) changed.push(rel);
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
  // plenty of English function words: English text quoting Spanish/Catalan names or titles
  if (score.en >= 4 && score.en >= 0.8 * Math.max(score.es, score.ca)) return 'en';
  const best = LANGS.reduce((a, b) => (score[b] > score[a] ? b : a), 'en');
  const others = Math.max(...LANGS.filter(l => l !== best).map(l => score[l]));
  // not sure (short or mixed text): let the translation service detect it
  return score[best] >= 2 && score[best] > 1.5 * others ? best : 'auto';
}

/* ---------- glossary: terms never translated (data/glossary.json → { "terms": [...] }) ----------
   Each term is swapped for a token before translating and put back afterwards; if the service mangles a
   token, the paragraph is translated again without protection (as before the glossary existed). */
const GLOSSARY = (() => { const g = readJSON('data/glossary.json', { terms: [] }); return [...new Set((g.terms || []).map(String).map(x => x.trim()).filter(Boolean))].sort((a, b) => b.length - a.length); })();
const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GLOSS_RE = GLOSSARY.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${GLOSSARY.map(reEsc).join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null;
function protect(text) {
  const found = [];
  const out = GLOSS_RE ? text.replace(GLOSS_RE, m => `ZZG${found.push(m) - 1}ZZ`) : text;
  return { out, found };
}
function restore(text, found) {
  let n = 0;
  const out = text.replace(/Z\s*Z\s*G\s*(\d+)\s*Z\s*Z/gi, (m, i) => { n++; return found[+i] ?? m; });
  return n === found.length && !/ZZG\d/i.test(out) ? out : null;
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
    const t = j.data.translations[0];
    return { text: t.translatedText, detected: t.detectedSourceLanguage || from };
  }
  const j = await getJSON(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ q: text }),
  });
  return { text: (j[0] || []).map(seg => seg[0]).join(''), detected: typeof j[2] === 'string' ? j[2] : from };
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
      try {
        const { out: safe, found } = protect(part);
        let r = await translateChunk(safe, from, to); failures = 0;
        let text = found.length ? restore(r.text, found) : r.text;
        if (text === null) { r = await translateChunk(part, from, to); text = r.text; }
        // a paragraph already written in the target language stays exactly as written
        done = String(r.detected || '').toLowerCase().startsWith(to) ? part : text;
      }
      catch (e) { if (attempt === 2) { failures++; warn(`translation ${from}→${to} failed: ${e.message}`); } else await sleep(1500 * (attempt + 1)); }
    }
    if (done === null) return null;
    out.push(done.trim() ? done : part);
    await sleep(120);
  }
  return out.join('');
}
/* arXiv papers: "arxiv.org/abs/2401.01234" or "arXiv:2401.01234" (their DOI is 10.48550/arXiv.<id>) */
const arxivOf = s => { const m = String(s || '').trim().match(/arxiv(?:\.org\/(?:abs|pdf)\/|:\s*)([a-z-]+\/\d{7}|\d{4}\.\d{4,5})/i) || String(s || '').trim().match(/^(\d{4}\.\d{4,5})(v\d+)?$/); return m ? m[1] : null; };
async function openAlex(pub) {
  if (OFFLINE) return null;
  const pick = 'select=title,keywords,topics,abstract_inverted_index';
  const arxiv = arxivOf(pub.link) || arxivOf(pub.text);
  const doi = doiOf(pub.link) || doiOf(pub.text) || (arxiv ? `10.48550/arXiv.${arxiv}` : null);
  try {
    if (doi) return await getJSON(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?${pick}`);
    const title = titleOf(pub.text);
    if (title.length < 12) return null;
    const j = await getJSON(`https://api.openalex.org/works?per-page=3&${pick}&search=${encodeURIComponent(title)}`);
    return (j.results || []).find(w => norm(w.title) === norm(title)) || null;
  } catch (e) { warn(`OpenAlex lookup failed for "${titleOf(pub.text)}": ${e.message}`); return null; }
}
/* When OpenAlex has no abstract: the journal's abstract registered in Crossref, or the arXiv abstract. */
async function otherAbstract(pub) {
  if (OFFLINE) return '';
  const doi = doiOf(pub.link) || doiOf(pub.text), arxiv = arxivOf(pub.link) || arxivOf(pub.text);
  try {
    if (doi && !/^10\.48550\//i.test(doi)) {
      const j = await getJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      const a = j?.message?.abstract; if (a) return a.replace(/<[^>]+>/g, ' ');
    }
    if (arxiv) {
      const r = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxiv)}`, { signal: AbortSignal.timeout(20000) });
      const m = r.ok && (await r.text()).match(/<entry>[\s\S]*?<summary>([\s\S]*?)<\/summary>/);
      if (m) return m[1];
    }
  } catch (e) { warn(`abstract lookup failed for "${titleOf(pub.text)}": ${e.message}`); }
  return '';
}
const abstractOf = w => {
  const idx = w && w.abstract_inverted_index; if (!idx) return '';
  const words = [];
  for (const [word, positions] of Object.entries(idx)) for (const p of positions) words[p] = word;
  return words.join(' ');
};

/* ---------- 1. keywords ----------
 * data/keywords.json             curated vocabulary (name + terms that detect it), kept by the site maintainers
 * data/publication-keywords.json curated keywords of specific papers (by DOI, or by title when there is no DOI)
 * <cache>/keywords-auto.json     keywords found automatically for every other paper
 * <cache>/keywords-bank.json     the bank: every keyword in use (curated and automatic), alphabetical, with the
 *                                number of papers; terms found automatically join it and are then detected in
 *                                later papers too. Keywords shared by two or more papers go to the home ribbon. */
const curated = (readJSON('data/keywords.json', { keywords: [] }).keywords || []).filter(k => k && k.name);
const BANK_REL = 'data/keywords-bank.json', AUTO_REL = 'data/keywords-auto.json';
const learned = ((readCache(BANK_REL, {}).keywords) || []).filter(k => k && k.name && k.auto);
const vocab = [...curated];
const known = new Set(curated.map(k => norm(k.name)));
for (const k of learned) if (!known.has(norm(k.name))) { vocab.push({ name: k.name, match: k.match || [], auto: true }); known.add(norm(k.name)); }
const canonical = new Map(vocab.map(k => [norm(k.name), k.name]));
const cleanKeyword = k => { const s = String(k || '').replace(/\s+/g, ' ').trim(); return canonical.get(norm(s)) || s; };
const cleanList = list => [...new Map((Array.isArray(list) ? list : list ? [list] : []).map(cleanKeyword).filter(Boolean).map(k => [norm(k), k])).values()];

async function suggestKeywords(pub) {
  const title = norm(titleOf(pub.text));
  const work = await openAlex(pub);
  const abstract = norm(abstractOf(work) || await otherAbstract(pub));
  const indexed = norm([...(work?.keywords || []).map(k => k.display_name), ...(work?.topics || []).slice(0, 3).map(t => t.display_name)].join(' · '));
  const scored = vocab.map(k => {
    const terms = [k.name, ...(k.match || [])];
    const inTitle = terms.some(t => hasTerm(title, t));
    const inIndexed = terms.some(t => hasTerm(indexed, t));
    const hits = terms.reduce((n, t) => n + countTerm(abstract, t), 0);
    return { name: k.name, score: (inTitle ? 4 : 0) + (inIndexed ? 2 : 0) + Math.min(hits, 3) };
  }).filter(k => k.score >= 2).sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 6).map(k => k.name);
  // few matches in the bank: add the keywords OpenAlex indexed for the paper (they join the bank)
  for (const k of (work?.keywords || []).filter(k => (k.score ?? 1) >= 0.4)) {
    if (picked.length >= 3) break;
    const name = cleanKeyword(titleCase(k.display_name));
    if (!picked.some(p => norm(p) === norm(name))) picked.push(name);
  }
  return picked;
}

const pubsDoc = readJSON('data/publications.json', { publications: [] });

/* ---------- 0. publications from their DOI ----------
 * <cache>/publications-meta.json  metadata already fetched for each DOI, so it is looked up only once */
const PUB_META_REL = 'data/publications-meta.json';
const metaOld = readCache(PUB_META_REL, {}), metaNew = {};
const pubDoi = s => { const d = doiOf(s); if (d) return d.toLowerCase(); const a = arxivOf(s); return a ? `10.48550/arxiv.${a}`.toLowerCase() : null; };
const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().replace(/\.$/, '');
const first = v => Array.isArray(v) ? v[0] : v;
const yearOf = d => d && d['date-parts'] && d['date-parts'][0] && d['date-parts'][0][0];
async function doiMeta(doi) {
  const ua = { 'User-Agent': 'opticsuab.eu site builder (https://opticsuab.eu)' };
  if (!doi.startsWith('10.48550/')) {
    try {
      const m = (await getJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: ua })).message;
      return { title: plain(first(m.title)), authors: m.author || [], journal: plain(first(m['short-container-title'])), journalFull: plain(first(m['container-title'])),
        volume: m.volume || '', issue: m.issue || '', page: m.page || '', article: m['article-number'] || '',
        year: yearOf(m['published-print']) || yearOf(m.issued) || yearOf(m['published-online']) || null, publisher: m.publisher || '' };
    } catch (e) { if (!/HTTP 404/.test(e.message)) throw e; }
  }
  /* DataCite (arXiv, Zenodo…) and anything Crossref does not know: the DOI's own citation data */
  const r = await fetch(`https://doi.org/${doi}`, { headers: { ...ua, Accept: 'application/vnd.citationstyles.csl+json' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return { missing: true };
  if (!r.ok) throw new Error(`HTTP ${r.status} for https://doi.org/${doi}`);
  const c = await r.json();
  return { title: plain(first(c.title)), authors: c.author || [], journal: plain(c['container-title-short'] || c.journalAbbreviation), journalFull: plain(first(c['container-title'])),
    volume: c.volume || '', issue: c.issue || '', page: c.page || '', article: c.number || '', year: yearOf(c.issued) || null, publisher: c.publisher || '',
    arxiv: doi.startsWith('10.48550/arxiv.') ? doi.slice('10.48550/arxiv.'.length) : '' };
}
/* Journal names as the site writes them. Crossref's short titles are used, with the full stops added
   ("Sci Rep" → "Sci. Rep."); journals whose short title is their full name are listed here. */
const JOURNALS = {
  'applied sciences': 'Appl. Sci.', 'optics and lasers in engineering': 'Opt. Lasers Eng.', 'optics & laser technology': 'Opt. Laser Technol.',
  'nature photonics': 'Nat. Photonics', 'optics express': 'Opt. Express', 'optics letters': 'Opt. Lett.', 'biomedical optics express': 'Biomed. Opt. Express',
  'physical review a': 'Phys. Rev. A', 'physical review b': 'Phys. Rev. B', 'physical review x': 'Phys. Rev. X', 'physical review letters': 'Phys. Rev. Lett.',
  'physical review research': 'Phys. Rev. Research', 'new journal of physics': 'New J. Phys.', 'journal of biophotonics': 'J. Biophotonics',
  'results in physics': 'Results Phys.', 'ieee sensors journal': 'IEEE Sens. J.', 'applied physics letters': 'Appl. Phys. Lett.',
  'review of scientific instruments': 'Rev. Sci. Instrum.', 'advanced optical materials': 'Adv. Optical Mater.', 'plos one': 'PLoS ONE',
  'the european physical journal d': 'Eur. Phys. J. D', 'europhysics letters': 'EPL', 'frontiers in physics': 'Front. Phys.', 'avs quantum science': 'AVS Quantum Sci.',
};
const journalOf = m => {
  const full = m.journalFull || '', short = m.journal || '';
  const known = JOURNALS[full.toLowerCase()] || JOURNALS[short.toLowerCase()];
  if (known) return known;
  if (!short) return full || m.publisher || '';
  const words = full.toLowerCase().split(/[\s-]+/);
  /* a word of the short title that only starts a word of the full title is an abbreviation: add its full stop */
  return short.split(' ').map(w => !/\.$/.test(w) && w.length > 1 && words.some(f => f !== w.toLowerCase() && f.startsWith(w.toLowerCase())) ? `${w}.` : w).join(' ');
};
/* "Jean-Luc" → "J.-L.", "María José" → "M. J.", "J.J." → "J. J." */
const initialsOf = given => String(given || '').replace(/\./g, '. ').split(/\s+/).filter(Boolean)
  .map(w => w.split('-').map(p => p ? p[0].toUpperCase() + '.' : '').join('-')).join(' ');
const caseName = s => (s === s.toUpperCase() && /\p{Lu}{3}/u.test(s) ? s.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, c => c.toUpperCase()) : s);
const authorList = authors => {
  const names = authors.map(a => a.literal || a.name || [initialsOf(a.given), caseName(a.family || '')].filter(Boolean).join(' ')).filter(Boolean);
  if (names.length > 15) return `${names.slice(0, 10).join(', ')}, et al.`;
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};
/* «Title». A. Author, B. Author, and C. Author, Journal Vol (Issue), Article (Year). — the format used on the site */
function formatReference(m) {
  const year = m.year ? ` (${m.year})` : '';
  let where;
  if (m.arxiv) where = `arXiv:${m.arxiv}${year}`;
  else {
    const page = m.article || (m.page ? (/[-–]/.test(m.page) ? `pp. ${m.page.replace('–', '-')}` : m.page) : '');
    where = `${journalOf(m)}${m.volume ? ` ${m.volume}` : ''}${m.issue ? ` (${m.issue})` : ''}${page ? `, ${page}` : ''}${year}`;
  }
  const who = authorList(m.authors || []);
  return `«${m.title}». ${who ? `${who}, ` : ''}${where}.`;
}
const titleWords = s => norm(s).split(' ').filter(w => w.length > 2);
const sameTitle = (written, real) => {
  const a = titleWords(written), b = new Set(titleWords(real));
  if (!a.length || !b.size) return false;
  const hits = a.filter(w => b.has(w)).length;
  return hits / a.length >= 0.75 && hits >= Math.min(3, a.length);
};
for (const pub of pubsDoc.publications || []) {
  if (!pub || String(pub.text || '').trim()) continue;          // a reference written by hand wins
  const doi = pubDoi(pub.doi) || pubDoi(pub.link);
  const title = String(pub.title || '').trim();
  if (!doi) {
    if (title) { pub.text = `«${title.replace(/\.$/, '')}».`; pub.hold = true; pub.warning = 'Falta el DOI: añádelo en el panel para completar la referencia.'; }
    continue;
  }
  let meta = metaOld[doi] || null;
  if (!meta && !OFFLINE) {
    try { meta = await doiMeta(doi); if (meta.title) log(`publication · ${doi} → ${meta.title.slice(0, 70)}`); }
    catch (e) { warn(`metadata lookup failed for ${doi}: ${e.message}`); }
  }
  pub.link = pub.link || `https://doi.org/${doi}`;
  if (!meta) {                                                   // not looked up yet: show what we have, try again next time
    pub.text = `«${(title || doi).replace(/\.$/, '')}».`;
    continue;
  }
  if (meta.missing) {
    pub.text = `«${title || doi}».`; pub.hold = true; pub.warning = `El DOI ${doi} no existe. Revísalo en el panel.`;
    warn(`publication "${title}": DOI ${doi} does not exist`);
    continue;
  }
  metaNew[doi] = meta;
  if (title && !sameTitle(title, meta.title)) {
    pub.text = `«${title}».`; pub.hold = true;
    pub.warning = `El DOI ${doi} corresponde a «${meta.title}», no al título escrito. Revisa el DOI o el título en el panel.`;
    warn(`publication "${title}": DOI ${doi} is "${meta.title}"`);
    continue;
  }
  pub.text = formatReference(meta);
  pub.year = meta.year || pub.year || new Date().getFullYear();
}
writeJSON(PUB_META_REL, metaNew);
const fixed = readJSON('data/publication-keywords.json', {});
const autoOld = readCache(AUTO_REL, {}), autoNew = {};
const pubKey = pub => { const doi = doiOf(pub.link) || doiOf(pub.text); return doi ? `doi:${doi.toLowerCase()}` : `title:${norm(titleOf(pub.text)).trim()}`; };
const counts = new Map();
for (const pub of pubsDoc.publications || []) {
  if (!pub || !pub.text) continue;
  const key = pubKey(pub);
  let list = cleanList(fixed[key] && fixed[key].keywords);
  if (!list.length) list = cleanList(pub.keywords); // keywords written directly in the publication, if any
  if (!list.length) {
    list = Array.isArray(autoOld[key]) && autoOld[key].length ? cleanList(autoOld[key]) : null;
    if (!list) {
      list = await suggestKeywords(pub);
      if (list.length) log(`keywords · ${titleOf(pub.text).slice(0, 70)} → ${list.join(', ')}`);
    }
    if (list.length) autoNew[key] = list;
  }
  pub.keywords = list;
  for (const k of list) {
    counts.set(k, (counts.get(k) || 0) + 1);
    if (!canonical.has(norm(k))) { vocab.push({ name: k, match: [k.toLowerCase()], auto: true }); canonical.set(norm(k), k); }
  }
}
/* ---------- 1b. research lines ----------
 * Four lines, same order as research_lines in site.json: imaging, polarimetry, simulations, quantum.
 * Every paper belongs to at least one. The editor picks them in the panel (field "lines" of each publication);
 * when the field is empty, they are guessed here with data/research-lines.json:
 *   lines[i].authors  group members whose papers usually belong to that line (+2)
 *   lines[i].terms    words of the title (+2 each) or keywords (+1 each), accent-free, matched at word start
 * A line is kept when it has words and scores at least half of the best line; with no words at all, the line(s)
 * with the best author score. Guessed lines are marked (linesAuto) and shown as a note with ?preview. */
const RL = readJSON('data/research-lines.json', { lines: [] });
const LINE_IDS = (RL.lines || []).map(l => l.id);
const authorsOf = text => norm(String(text || '').replace(/«[^»]*»/, ' '));   /* the reference without its title */
function guessLines(pub) {
  const title = norm(titleOf(pub.text)), kws = norm((pub.keywords || []).join(' · ')), authors = authorsOf(pub.text);
  const s = (RL.lines || []).map(l => {
    const people = (l.authors || []).some(a => hasTerm(authors, a)) ? 2 : 0;
    const words = (l.terms || []).reduce((n, w) => n + (hasTerm(title, w) ? 2 : 0) + (hasTerm(kws, w) ? 1 : 0), 0);
    return { id: l.id, people, words: Math.min(words, 8), total: people + Math.min(words, 8) };
  });
  const best = Math.max(...s.map(x => x.total), 0);
  if (!best) return [];
  let picked = s.filter(x => x.words && x.total >= best / 2);
  if (!picked.length) { const top = Math.max(...s.map(x => x.people)); picked = s.filter(x => x.people === top); }
  return picked.map(x => x.id);
}
const validLines = list => [...new Set((Array.isArray(list) ? list : list ? [list] : []).map(String).filter(id => LINE_IDS.includes(id)))];
const lineCounts = {};
for (const pub of pubsDoc.publications || []) {
  if (!pub || !pub.text) continue;
  const chosen = validLines(pub.lines);
  if (chosen.length) pub.lines = chosen;
  else {
    pub.lines = guessLines(pub); pub.linesAuto = true;
    log(`research lines · guessed ${pub.lines.join(', ') || '—'} · ${titleOf(pub.text).slice(0, 70)}`);
  }
  for (const l of pub.lines.length ? pub.lines : ['none']) lineCounts[l] = (lineCounts[l] || 0) + 1;
}
log(`research lines · ${Object.entries(lineCounts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (process.env.LINES_CHECK) {
  let same = 0, overlap = 0, n = 0;
  for (const pub of pubsDoc.publications || []) if (pub && pub.text && !pub.linesAuto) {
    const auto = guessLines(pub), cur = pub.lines; n++;
    if (auto.length === cur.length && auto.every(x => cur.includes(x))) same++;
    else { if (auto.some(x => cur.includes(x))) overlap++; log(`  line check · chosen ${cur.join('+')} · guessed ${auto.join('+') || '—'} · ${titleOf(pub.text).slice(0, 70)}`); }
  }
  log(`  line check · ${same}/${n} identical, ${overlap} partly`);
}

const bank = vocab
  .filter(k => !k.auto || counts.get(k.name))
  .map(k => ({ name: k.name, papers: counts.get(k.name) || 0, shared: (counts.get(k.name) || 0) >= 2, ...(k.auto ? { auto: true } : {}), match: k.match || [] }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
writeJSON(BANK_REL, { keywords: bank });
writeJSON(AUTO_REL, autoNew);
writeJSON('data/publications.json', pubsDoc, { stored: false });

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
    const kept = readJSON(rel, {}), cached = readCache(rel, {});
    const memory = {};
    for (const [c, text, from] of units) {
      if (c !== col || text in memory) continue;
      if (typeof kept[text] === 'string') { memory[text] = kept[text]; continue; } // committed (possibly hand-corrected) translation
      if (from === lang) continue;
      if (typeof cached[text] === 'string') { memory[text] = cached[text]; continue; }
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
