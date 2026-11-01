#!/usr/bin/env node
/* Static pages for search engines and link previews. Runs in tools/publish.sh after build-content.mjs:
     node tools/build-pages.mjs --site <folder about to be published>
   For every page of the site (js/routes.js) and every language it writes <path>/index.html: the same page shell as
   index.html (the browser then shows the full interactive page) with its own title, description, canonical address,
   language alternates, Open Graph / Twitter tags, structured data and a plain-HTML version of the content. It also
   writes 404.html, sitemap.xml and robots.txt. Uses only Node's standard library. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const SITE = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;
if (!SITE) { console.error('usage: node tools/build-pages.mjs --site <dir>'); process.exit(2); }

/* the browser files define the dictionary (i18n.js) and the site map (routes.js) as globals */
const ctx = vm.createContext({});
for (const f of ['js/i18n.js', 'js/routes.js']) vm.runInContext(`${readFileSync(join(SITE, f), 'utf8')}\n;globalThis.__x = 1;`, ctx, { filename: f });
const G = vm.runInContext('({ LANGS, MONTHS, DESC, I18N, SITE_URL, LANG_PREFIX, PAGE_META, NAV_TREE, DRAFT_PAGES, PUBLIC_PAGES, newsSlug })', ctx);
const { LANGS, MONTHS, DESC, I18N, SITE_URL, LANG_PREFIX, PAGE_META, NAV_TREE, PUBLIC_PAGES, newsSlug } = G;
const LANG_CODES = LANGS.map(l => l[0]);
const LOCALE = { en: 'en_GB', es: 'es_ES', ca: 'ca_ES' };

const read = (rel, fallback) => { const f = join(SITE, rel); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback; };
const data = {
  news: read('data/news.json', { news: [] }).news || [],
  people: read('data/people.json', { people: [] }).people || [],
  pubs: read('data/publications.json', { publications: [] }).publications || [],
  theses: read('data/theses.json', { theses: [] }).theses || [],
  patents: read('data/patents.json', { patents: [] }).patents || [],
  master: read('data/master-theses.json', { master_theses: [] }).master_theses || [],
  pages: read('data/pages.json', {}),
  site: read('data/site.json', {}),
  maint: read('data/maintenance.json', { enabled: false }),
};
const mem = Object.fromEntries(LANG_CODES.map(l => [l, Object.fromEntries(['news', 'people', 'site', 'pages'].map(c => [c, read(`data/i18n/${l}/${c}.json`, {})]))]));
const template = readFileSync(join(SITE, 'index.html'), 'utf8');
if (!/<!-- page-meta[\s\S]*?<!-- \/page-meta -->/.test(template) || !/<!-- page-content -->[\s\S]*?<!-- \/page-content -->/.test(template)) {
  console.error('index.html is missing the <!-- page-meta --> / <!-- page-content --> markers'); process.exit(1);
}

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const t = (lang, s, v) => { let r = (I18N[lang] && I18N[lang][s]) || String(s).replace(/^step:/, ''); if (v) for (const k in v) r = r.replaceAll(`{${k}}`, v[k]); return r; };
const tr = (lang, col, s) => (s && typeof mem[lang][col][s] === 'string' && mem[lang][col][s]) || s;
const paras = s => String(s || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
const pagePath = (path, lang) => `${LANG_PREFIX[lang]}/${path ? `${path}/` : ''}`;
const abs = (path, lang) => SITE_URL + pagePath(path, lang);
const absImg = src => (src ? (/^https?:/.test(src) ? src : SITE_URL + (src.startsWith('/') ? '' : '/') + src) : '');
const clip = (s, n = 160) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s; };
const link = (path, lang, text) => `<a href="${pagePath(path, lang)}">${esc(text)}</a>`;
const news = data.news.filter(n => n && n.title).map(n => {
  const [y, m] = String(n.date || '').split('-').map(Number);
  return { ...n, y: y || 0, m: m || 1, id: newsSlug(y || 0, m || 1, n.title), imgs: Array.isArray(n.images) ? n.images.filter(Boolean) : (n.images ? [n.images] : []) };
}).sort((a, b) => (b.y - a.y) || (b.m - a.m));
const byYear = rows => [...rows].sort((a, b) => (+b.year || 0) - (+a.year || 0));
const refList = (rows, lang) => `<ul>${byYear(rows).map(r => `<li>${esc(r.year)} · ${esc(r.text)}${r.link && /^https?:/.test(r.link) ? ` <a href="${esc(r.link)}" rel="noopener">${esc(t(lang, 'Open'))}</a>` : ''}</li>`).join('')}</ul>`;
const stripHtml = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/(src|href)="img\//g, '$1="/img/');

/* ---------- content of each page (plain HTML, read by crawlers and shown if scripts fail) ---------- */
function body(path, lang) {
  const site = data.site, T = s => t(lang, s);
  if (!path) {
    const latest = news.slice(0, 6).map(n => `<li>${link(`news/${n.id}`, lang, tr(lang, 'news', n.title))}</li>`).join('');
    const lines = (site.research_lines || []).map(l => `<h3>${esc(tr(lang, 'site', l.title))}</h3><p>${esc(tr(lang, 'site', l.description))}</p>`).join('');
    return `<h1>${esc(tr(lang, 'site', site.hero_title || 'Optics Group'))}</h1><p>${esc(tr(lang, 'site', site.hero_subtitle || ''))}</p>${lines}<h2>${esc(T('News'))}</h2><ul>${latest}</ul>`;
  }
  const [sec, sub] = path.split('/');
  if (sec === 'news' && sub) {
    const n = news.find(x => x.id === sub);
    return `<article><p>${esc(MONTHS[lang][n.m])} ${n.y} · ${esc(T(n.category || 'News'))}</p><h1>${esc(tr(lang, 'news', n.title))}</h1>${paras(tr(lang, 'news', n.text)).map(p => `<p>${esc(p)}</p>`).join('')}${n.imgs.map(i => `<img src="${esc(i)}" alt="${esc(tr(lang, 'news', n.title))}">`).join('')}${n.link ? `<p><a href="${esc(n.link)}" rel="noopener">${esc(T('More information'))}</a></p>` : ''}</article>`;
  }
  const [title, lead] = PAGE_META[path];
  const head = `<h1>${esc(T(title))}</h1>${lead ? `<p>${esc(t(lang, lead, { n: data.people.length }))}</p>` : ''}`;
  const pages = Object.assign({}, data.pages, mem[lang].pages);
  const people = groups => `<ul>${data.people.filter(p => p && p.name && (!groups || groups.includes(p.group))).map(p => `<li>${esc(p.name)}${p.position ? ` · ${esc(T(p.position))}` : ''}</li>`).join('')}</ul>`;
  switch (path) {
    case 'research/lines': return head + (site.research_lines || []).map(l => `<h2>${esc(tr(lang, 'site', l.title))}</h2><p>${esc(tr(lang, 'site', l.description))}</p>`).join('');
    case 'research/publications': return head + refList(data.pubs, lang);
    case 'research/patents': return head + refList(data.patents, lang);
    case 'research/theses': return head + refList(data.theses, lang);
    case 'teaching/master-thesis': return head + refList(data.master, lang);
    case 'research/datasets': return head + stripHtml(pages.datasets);
    case 'research/collaborations': return head + stripHtml(pages.collaborations);
    case 'teaching/courses': return head + stripHtml(pages.courses);
    case 'outreach/activities': return head + stripHtml(pages.outreach);
    case 'outreach/talks': return head + stripHtml(pages.talks);
    case 'outreach/interviews': return head + stripHtml(pages.interviews);
    case 'about/gender': return head + stripHtml(pages.gender);
    case 'about/reach': return head + stripHtml(pages.how_to_reach_us);
    case 'people/current': return head + people(null);
    case 'people/investigators': return head + people(['Staff']);
    case 'people/students': return head + people(['Postdoctoral researchers', 'PhD students']);
    case 'people/honorary': return head + people(['Emeritus & honorary professors']);
    case 'news': return head + `<ul>${news.map(n => `<li>${esc(MONTHS[lang][n.m])} ${n.y} · ${link(`news/${n.id}`, lang, tr(lang, 'news', n.title))}</li>`).join('')}</ul>`;
    case 'about/mission': return head + `<p>${esc(T('The Optics Group is a team of researchers at the Physics Department of the Universitat Autònoma de Barcelona who specialise in the study of light and its applications, spanning classical and quantum optics.'))}</p>`;
    case 'contact': return head + `<p>${esc(T('Physics Department, Facultat de Ciències, Edifici C (area C3 Parell)'))}<br>Universitat Autònoma de Barcelona<br>E-08193 Bellaterra (Cerdanyola del Vallès)</p>`;
    default: return head;
  }
}

/* ---------- head tags ---------- */
function headTags(path, lang, { title, description, image, type = 'website', jsonld = null }) {
  const alt = LANG_CODES.map(l => `<link rel="alternate" hreflang="${l}" href="${abs(path, l)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${abs(path, 'en')}">`;
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(path, lang)}">
${alt}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(t(lang, 'Optics Group · UAB'))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(path, lang)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:locale" content="${LOCALE[lang]}">
${LANG_CODES.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">${jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}`;
}
function pageFor(path, lang) {
  const site = t(lang, 'Optics Group · UAB');
  let title = site, description = DESC[lang] || DESC.en, image = `${SITE_URL}/img/og-default.png`, type = 'website', jsonld = null;
  const [sec, sub] = path.split('/');
  if (!path) {
    jsonld = { '@context': 'https://schema.org', '@type': 'ResearchOrganization', name: site, url: abs('', lang), logo: `${SITE_URL}/img/icons/icon-512.png`,
      parentOrganization: { '@type': 'CollegeOrUniversity', name: 'Universitat Autònoma de Barcelona', url: 'https://www.uab.cat' },
      address: { '@type': 'PostalAddress', streetAddress: 'Facultat de Ciències, Edifici C', addressLocality: 'Bellaterra (Cerdanyola del Vallès)', postalCode: '08193', addressCountry: 'ES' } };
  } else if (sec === 'news' && sub) {
    const n = news.find(x => x.id === sub);
    title = `${tr(lang, 'news', n.title)} · ${site}`;
    description = clip(paras(tr(lang, 'news', n.text))[0] || description);
    if (n.imgs[0]) image = absImg(n.imgs[0]);
    type = 'article';
    jsonld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: clip(tr(lang, 'news', n.title), 110), datePublished: n.date, inLanguage: lang,
      image: n.imgs.map(absImg), mainEntityOfPage: abs(path, lang), publisher: { '@type': 'Organization', name: site, url: SITE_URL } };
  } else {
    const [ti, lead] = PAGE_META[path];
    title = `${t(lang, ti)} · ${site}`;
    if (lead) description = t(lang, lead, { n: data.people.length });
  }
  const content = data.maint.enabled ? `<h1>${esc(tr(lang, 'site', data.maint.title) || t(lang, 'Under maintenance'))}</h1>` : body(path, lang);
  return template
    .replace(/<html lang="[^"]*">/, () => `<html lang="${lang}">`)
    .replace(/<!-- page-meta[\s\S]*?<!-- \/page-meta -->/, () => `<!-- page-meta -->\n${headTags(path, lang, { title, description, image, type, jsonld })}\n<!-- /page-meta -->`)
    .replace(/<!-- page-content -->[\s\S]*?<!-- \/page-content -->/, () => `<!-- page-content --><div class="static-page wrap">${content}</div><!-- /page-content -->`);
}

/* ---------- write everything ---------- */
const paths = [...PUBLIC_PAGES, ...news.map(n => `news/${n.id}`)];
const urls = [];
let count = 0;
for (const lang of LANG_CODES) {
  for (const path of paths) {
    const file = join(SITE, pagePath(path, lang), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, pageFor(path, lang));
    count++;
  }
}
for (const path of paths) urls.push(path);

/* 404: the page shell (the browser shows the "not found" page, or the right page for an address it knows) */
writeFileSync(join(SITE, '404.html'), template
  .replace(/<!-- page-meta[\s\S]*?<!-- \/page-meta -->/, () => `<title>${esc(t('en', 'Page not found'))} · Optics Group · UAB</title>\n<meta name="description" content="${esc(DESC.en)}">\n<meta name="robots" content="noindex">`)
  .replace(/<!-- page-content -->[\s\S]*?<!-- \/page-content -->/, () => `<!-- page-content --><div class="static-page wrap"><h1>${esc(t('en', 'Page not found'))}</h1><p><a href="/">Optics Group · UAB</a></p></div><!-- /page-content -->`));

const today = new Date().toISOString().slice(0, 10);
const newsDate = new Map(news.map(n => [`news/${n.id}`, /^\d{4}-\d{2}-\d{2}/.test(n.date || '') ? n.date.slice(0, 10) : null]));
writeFileSync(join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap(path => LANG_CODES.map(lang => `<url><loc>${abs(path, lang)}</loc>${newsDate.get(path) ? `<lastmod>${newsDate.get(path)}</lastmod>` : ''}${LANG_CODES.map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(path, l)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${abs(path, 'en')}"/></url>`)).join('\n')}
</urlset>
`);
writeFileSync(join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
void 0;
console.log(`Static pages: ${count} (${paths.length} pages × ${LANG_CODES.length} languages), 404.html, sitemap.xml (${urls.length * LANG_CODES.length} addresses), robots.txt. Built ${today}.`);
void NAV_TREE;
