const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/* ---------- language: UI texts come from js/i18n.js; content edited in the panel can be written in any language and is
   translated automatically into data/i18n/<lang>/*.json (see tools/build-content.mjs) ---------- */
/* The language is part of the address: / (English), /es/…, /ca/… (LANG_PREFIX in js/routes.js). */
const langOfPath = pathname => (pathname.match(/^\/(es|ca)(?=\/|$)/) || [])[1] || 'en';
let LANG = langOfPath(location.pathname), MON = MONTHS[LANG];
const t = (s, v) => {
  let r = (I18N[LANG] && I18N[LANG][s]) || s.replace(/^step:/, '');
  if (v) for (const k in v) r = r.replaceAll(`{${k}}`, v[k]);
  return r;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = d => `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const I_RIGHT = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
const I_LEFT = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>');
const I_EXT = svg('<path d="M7 17 17 7M8 7h9v9"/>');
const ARR = `<span class="arr">${I_RIGHT}</span>`;

/* ?preview shows the site in maintenance mode and the editorial notes / draft pages that the public does not see.
   It is kept while browsing (internal links carry it) and for the rest of the browser session. */
const PREVIEW = (() => {
  let on = new URLSearchParams(location.search).has('preview');
  try { if (on) sessionStorage.setItem('preview', '1'); else on = sessionStorage.getItem('preview') === '1'; } catch (e) { /* storage blocked */ }
  return on;
})();
const isDraft = (sec, sub) => isDraftPath(`${sec}/${sub}`, PREVIEW);
const NAV = navFor(PREVIEW);
/* Contact form: messages are delivered by Web3Forms to the group mailbox (address not shown on the site). */
const CONTACT_FORM_KEY = '46d4bbb9-39ba-4003-bb12-f1387a4519db';
let MAINT = { enabled: false };
let SITE = { hero_eyebrow: '', hero_title: '', hero_subtitle: '', research_lines: [] }, LINES = [], KEYWORDS = [], KW_MEM = {};
/* ---------- data (edited from the Pages CMS panel, stored in /data/*.json) ---------- */
let NEWS = [], PEOPLE = [], PUBS = [], THESES = [], PATENTS = [], MASTER = [], FORMER = '', INTERVIEWS = '', GENDER_TALKS = '', PAGES_HTML = {};
const paras = t => String(t || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
const asList = v => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
/* Same publication key as tools/build-content.mjs: doi:<doi> or title:<normalised title>. */
const kNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[\u2010-\u2015\-_/]+/g, ' ').replace(/[^a-z0-9·' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const kTitle = text => { const m = String(text || '').match(/[«"“]\s*(.+?)\s*[»"”«]/); return (m ? m[1] : String(text || '').split('.')[0]).replace(/\s+/g, ' ').trim(); };
const kDoi = s => { const m = String(s || '').match(/10\.\d{4,9}\/[^\s"<>?#]+/); return m ? m[0].replace(/[.,;)]+$/, '') : null; };
const pubKey = r => { const doi = kDoi(r.link) || kDoi(r.text); return doi ? `doi:${doi.toLowerCase()}` : `title:${kNorm(kTitle(r.text))}`; };
/* Links typed in the panel: add https:// when missing ("www.x.org", "doi.org/…"), turn a bare DOI or ORCID iD into its
   address, keep site paths (/…, #…) and drop anything else with a scheme (javascript:, data:…). */
const safeUrl = (u, kind) => {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:)/i.test(u) || /^[/#]/.test(u)) return u;
  if (/^10\.\d{4,9}\//.test(u)) return `https://doi.org/${u}`;
  if (kind === 'orcid' && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(u)) return `https://orcid.org/${u}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || /\s/.test(u) || !/\.[a-z]{2,}/i.test(u)) return '';
  return `https://${u.replace(/^\/+/, '')}`;
};
const byYear = rows => rows.map(r => ({ y: +r.year || 0, t: r.text || '', u: safeUrl(r.link) || null, kw: asList(r.keywords).map(String) })).sort((a, b) => b.y - a.y);
const RECORD_TERMS = {
  es: [
    ['PhD in Physics', 'Doctorado en Física'], ['Phd in Physics', 'Doctorado en Física'],
    ['Thesis supervisors:', 'Dirección de tesis:'], ['Thesis supervisor:', 'Dirección de tesis:'],
    ['Master in Quantum Science and Technology', 'Máster en Ciencia y Tecnología Cuánticas'],
    ['Erasmus Mundus Master’s degree in Photonics', 'Máster Erasmus Mundus en Fotónica'],
    ['Master in Photonics', 'Máster en Fotónica'],
    ['Master in Modelling for Science and Engineering', 'Máster en Modelización para la Ciencia y la Ingeniería'],
    ['Supervisor(s):', 'Dirección:'], ['Supervisors:', 'Directores:'], ['Supervisor:', 'Director:'],
    ['Publication Number:', 'Número de publicación:'], ['Publication Date:', 'Fecha de publicación:'],
    ['International Application No.:', 'N.º de solicitud internacional:'], ['International Filing Date:', 'Fecha de presentación internacional:'],
    ['Applicants:', 'Solicitantes:'],
  ],
  ca: [
    ['PhD in Physics', 'Doctorat en Física'], ['Phd in Physics', 'Doctorat en Física'],
    ['Thesis supervisors:', 'Direcció de tesi:'], ['Thesis supervisor:', 'Direcció de tesi:'],
    ['Master in Quantum Science and Technology', 'Màster en Ciència i Tecnologia Quàntiques'],
    ['Erasmus Mundus Master’s degree in Photonics', 'Màster Erasmus Mundus en Fotònica'],
    ['Master in Photonics', 'Màster en Fotònica'],
    ['Master in Modelling for Science and Engineering', 'Màster en Modelització per a la Ciència i l’Enginyeria'],
    ['Supervisor(s):', 'Direcció:'], ['Supervisors:', 'Directors:'], ['Supervisor:', 'Director:'],
    ['Publication Number:', 'Número de publicació:'], ['Publication Date:', 'Data de publicació:'],
    ['International Application No.:', 'Núm. de sol·licitud internacional:'], ['International Filing Date:', 'Data de presentació internacional:'],
    ['Applicants:', 'Sol·licitants:'],
  ],
};
const localizeRecord = value => (RECORD_TERMS[LANG] || []).reduce((text, [from, to]) => text.replaceAll(from, to), value);
const getJSON = f => fetch(`/data/${f}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f + ': ' + r.status); return r.json(); });
let RAW = null;
const OVERLAYS = {};
const getOptionalJSON = f => getJSON(f).catch(err => { console.warn(`Optional translation unavailable: ${f}`, err); return {}; });
/* Translations are { "source text": "translation" } per language; a text without one is shown as written. */
const tr = (mem, s) => (s && mem && typeof mem[s] === 'string' && mem[s]) || s;
async function loadOverlay(lang) {
  if (!OVERLAYS[lang]) {
    const files = ['news', 'people', 'site', 'keywords', ...(lang === 'en' ? [] : ['pages'])];
    const loaded = await Promise.all(files.map(f => getOptionalJSON(`i18n/${lang}/${f}`)));
    OVERLAYS[lang] = Object.fromEntries(files.map((f, i) => [f, loaded[i]]));
  }
  return OVERLAYS[lang];
}
async function loadData() {
  MAINT = await getJSON('maintenance').catch(() => ({ enabled: false }));
  if (MAINT.enabled && !PREVIEW) {
    const site = (await loadOverlay(LANG)).site;
    MAINT = Object.assign({}, MAINT, { title: tr(site, MAINT.title), message: tr(site, MAINT.message) });
    return;
  }
  if (!RAW) {
    const [news, people, pubs, theses, patents, master, former, pages, site] = await Promise.all(
      ['news', 'people', 'publications', 'theses', 'patents', 'master-theses', 'former-members', 'pages', 'site'].map(getJSON));
    /* The publish process adds `keywords` to each publication. When it has not run (a local copy), fall back to the
       keywords fixed by hand in data/publication-keywords.json, matched with the same key as tools/build-content.mjs. */
    if (!(pubs.publications || []).some(r => r && r.keywords && r.keywords.length)) {
      const fixed = await getJSON('publication-keywords').catch(() => ({}));
      (pubs.publications || []).forEach(r => { const e = r && fixed[pubKey(r)]; if (e && !r.keywords) r.keywords = e.keywords; });
    }
    RAW = { news, people, pubs, theses, patents, master, former, pages, site, maint: MAINT };
  }
  const [ov, en] = await Promise.all([loadOverlay(LANG), loadOverlay('en')]);
  buildData(ov, en);
}
function buildData(ov, en = {}) {
  const { news, people, pubs, theses, patents, master, former } = RAW, T = (col, s) => tr(ov[col], s);
  /* fixed UI terms (positions, statuses) keep the hand-made wording from js/i18n.js when it has one */
  const term = s => (s && I18N[LANG] && I18N[LANG][s]) ? s : T('people', s);
  const pages = Object.assign({}, RAW.pages, ov.pages || {});
  const site = RAW.site || {};
  SITE = { hero_eyebrow: T('site', site.hero_eyebrow || ''), hero_title: T('site', site.hero_title || ''), hero_subtitle: T('site', site.hero_subtitle || ''),
    research_lines: asList(site.research_lines).map(l => ({ title: T('site', l.title), description: T('site', l.description), tags: asList(l.tags).map(x => T('site', x)) })) };
  LINES = SITE.research_lines.map(l => ({ t: l.title || '', d: l.description || '', tags: l.tags }));
  NEWS = (news.news || []).filter(n => n && n.title).map(n => {
    const [y, m] = String(n.date || '').split('-').map(Number);
    return { y: y || 0, m: m || 1, cat: n.category || 'News', src: n.title, en: tr(en.news, n.title), title: T('news', n.title), text: paras(T('news', n.text)), img: asList(n.images), link: safeUrl(n.link),
      call: n.open_call === true, callType: n.call_type || '', deadline: /^\d{4}-\d{2}-\d{2}/.test(n.deadline || '') ? n.deadline.slice(0, 10) : '' };
  }).sort((a, b) => (b.y - a.y) || (b.m - a.m));
  PEOPLE = (people.people || []).filter(p => p && p.name).map(p => {
    const about = paras(T('people', p.about));
    return { name: p.name, group: p.group, pos: term(p.position), office: p.office, mail: p.email, photo: p.photo, bio: T('people', p.summary),
      about: about.length ? about : null, status: term(p.status),
      scholar: safeUrl(p.scholar), orcid: safeUrl(p.orcid, 'orcid'), scopus: safeUrl(p.scopus), wos: safeUrl(p.wos), rid: safeUrl(p.researcherid),
      linkedin: safeUrl(p.linkedin), web: safeUrl(p.web) };
  });
  PUBS = byYear(pubs.publications || []); THESES = byYear(theses.theses || []); PATENTS = byYear(patents.patents || []); MASTER = byYear(master.master_theses || []);
  /* keywords: one entry per keyword used in the publications, most used first */
  KW_MEM = ov.keywords || {};
  const counts = new Map();
  PUBS.forEach(r => new Set(r.kw).forEach(k => counts.set(k, (counts.get(k) || 0) + 1)));
  KEYWORDS = [...counts].map(([k, n]) => ({ k, n, label: kwLabel(k) })).sort((a, b) => (b.n - a.n) || a.label.localeCompare(b.label, LANG));
  FORMER = (former.groups || []).map(g => `<h2>${esc(T('site', g.title))}</h2>${asList(g.names).map(n => `<h3 class="yr">${esc(n)}</h3>`).join('\n')}`).join('\n');
  INTERVIEWS = pages.interviews || ''; GENDER_TALKS = pages.talks || '';
  PAGES_HTML = { outreach: pages.outreach, reach: pages.how_to_reach_us, gender: pages.gender, collaborations: pages.collaborations, links: pages.links, societies: pages.societies, courses: pages.courses, datasets: pages.datasets };
  MAINT = Object.assign({}, RAW.maint, { title: T('site', RAW.maint.title), message: T('site', RAW.maint.message) });
}
const kwLabel = k => tr(KW_MEM, k);
const kwHref = k => `#/research/publications?${new URLSearchParams({ kw: k })}`;
const initials = n => n.replace(/^Dr\.\s*/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');
/* Open calls (PhD, postdoc…): news marked "Convocatoria abierta" in the panel, until the day after their deadline. */
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const openCalls = () => NEWS.filter(n => n.call && (!n.deadline || n.deadline >= localToday()));
const fmtDay = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m]} ${y}`; };
const callMeta = n => [t(n.callType === 'PhD' ? 'PhD' : n.callType === 'Postdoc' ? 'Postdoc' : 'Open call'), n.deadline ? t('Deadline: {d}', { d: fmtDay(n.deadline) }) : ''].filter(Boolean).join(' · ');
const newsId = n => newsSlug(n.y, n.m, n.src);

/* ---------- pieces ---------- */
const imageFrame = (src, alt = '') => `<div class="photo-frame"><img src="${src}" alt="${esc(alt)}" loading="lazy"></div>`;
const selectControl = (id, label, options, selected, name = '', variant = '') => {
  const choice = options.find(([value]) => String(value) === String(selected)) || options[0];
  const value = String(choice[0]);
  return `<div class="ui-select ${variant}" data-ui-select data-label="${esc(label)}">
    <input type="hidden" data-ui-select-value data-default-value="${esc(value)}"${name ? ` name="${esc(name)}"` : ''} value="${esc(value)}">
    <button class="ui-select-trigger" type="button" data-ui-select-trigger aria-label="${esc(label)}: ${esc(choice[1])}" aria-haspopup="menu" aria-expanded="false" aria-controls="${esc(id)}-menu">
      <span data-ui-select-current>${esc(choice[1])}</span><span class="lang-chevron" aria-hidden="true"></span>
    </button>
    <div class="drop ui-select-menu" id="${esc(id)}-menu" role="menu" aria-label="${esc(label)}">
      ${options.map(([optionValue, optionLabel]) => {
        const checked = String(optionValue) === value;
        return `<button class="ui-select-option" type="button" data-ui-select-option role="menuitemradio" data-value="${esc(String(optionValue))}" aria-checked="${checked}" tabindex="${checked ? 0 : -1}">${esc(optionLabel)}</button>`;
      }).join('')}
    </div>
  </div>`;
};
const newsCard = (n, i = 0) => {
  const sum = (n.text[0] || '').slice(0, 150) + ((n.text[0] || '').length > 150 ? '…' : '');
  return `<a class="card rv tilt" style="--i:${i}" href="#/news/${newsId(n)}">
    ${n.img[0] ? imageFrame(n.img[0], n.title) : '<div class="noimg"></div>'}
    <div class="body"><div class="meta"><span class="chip ${n.cat}">${t(n.cat)}</span>${MON[n.m]} ${n.y}</div><h3>${esc(n.title)}</h3><p>${esc(sum)}</p><span class="more">${t('Read more')} ${ARR}</span></div></a>`;
};
const personCard = (p, i = 0) => `<article class="person rv" style="--i:${i % 8}" data-p="${PEOPLE.indexOf(p)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(t('{name}: view profile', { name: p.name }))}">
  ${p.photo ? imageFrame(p.photo, '') : `<div class="noph">${esc(initials(p.name))}</div>`}
  <div class="body"><h3>${esc(p.name)}</h3><div class="meta">${esc(t(p.pos || p.group))}${p.office ? ' · ' + esc(p.office) : ''}</div>
  ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}<span class="more">${t('View profile')} ${ARR}</span></div></article>`;
const LINKS = [['linkedin', 'LinkedIn'], ['scholar', 'Google Scholar'], ['orcid', 'ORCID'], ['scopus', 'Scopus'], ['wos', 'Web of Science'], ['rid', 'ResearcherID'], ['web', 'Website']];
const profile = p => `<header class="pm-head"><div class="pm-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<div class="noph">${esc(initials(p.name))}</div>`}</div>
  <div class="pm-id"><div class="eyebrow">${esc(t(p.group))}</div><h2 id="pm-t">${esc(p.name)}</h2>
  <div class="meta">${esc(t(p.pos || ''))}${p.office ? ' · ' + esc(t('Office {x}', { x: p.office })) : ''}</div>
  ${p.status ? `<span class="chip Event">${esc(t(p.status))}</span>` : ''}</div></header>
  <div class="pm-body">${(p.about || (p.bio ? [p.bio] : [])).map(t => `<p>${esc(t)}</p>`).join('')}
  <div class="pm-links">${p.mail ? `<a class="btn" href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : ''}${LINKS.filter(([k]) => p[k]).map(([k, l]) => `<a class="btn btn-line" href="${esc(p[k])}" target="_blank" rel="noopener">${l} ${I_EXT}</a>`).join('')}</div></div>`;
let pmLast;
const openProfile = el => {
  const p = PEOPLE[+el.dataset.p]; if (!p) return;
  let d = $('#pm'); if (!d) { d = document.createElement('dialog'); d.id = 'pm'; d.setAttribute('aria-labelledby', 'pm-t'); document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('.pm-x')) d.close(); }); d.addEventListener('close', () => pmLast && pmLast.focus()); }
  pmLast = el; d.innerHTML = `<button class="pm-x" aria-label="${t('Close')}">×</button><div class="pm">${profile(p)}</div>`; d.showModal();
};
document.addEventListener('click', e => { const c = e.target.closest('.person[data-p]'); if (c) openProfile(c); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.person[data-p]')) { e.preventDefault(); openProfile(e.target); } });
const pubRow = (r, i = 0, label, activeKw = '') => `<div class="row rv" style="--i:${i % 6}"${r.kw && r.kw.length ? ` data-kw="${esc(r.kw.join('|'))}"` : ''}><span class="yr">${r.y}</span>
  <div class="t">${esc(localizeRecord(r.t))}${r.kw && r.kw.length ? `<div class="kws">${r.kw.map(k => `<a class="kw${k === activeKw ? ' on' : ''}" href="${esc(kwHref(k))}">${esc(kwLabel(k))}</a>`).join('')}</div>` : ''}</div>${r.u ? `<a class="go" href="${esc(r.u)}" target="_blank" rel="noopener">${t(label || 'Open')} ${I_EXT}</a>` : '<span></span>'}</div>`;
/* Title and description of a fixed page (PAGE_META in js/routes.js). */
const metaOf = (key, vars) => { const m = PAGE_META[key] || ['', '']; return [m[0], m[1] ? t(m[1], vars) : '']; };
const pageHead = (path, title, sub, crumbs) => `<header class="phead"><canvas class="bg"></canvas>
  <div class="wrap"><nav class="crumbs" aria-label="${t('Breadcrumb')}"><a href="#/">${t('Home')}</a>${crumbs.map(c => `<span>/</span>${c[1] ? `<a href="${c[1]}">${t(c[0])}</a>` : `<span>${t(c[0])}</span>`}`).join('')}</nav>
  <h1>${esc(t(title))}</h1>${sub ? `<p class="lead">${esc(t(sub))}</p>` : ''}${subnav(path)}</div>
  <canvas class="dissolve" data-color="#f4f7fb"></canvas></header>`;
function subnav(path) {
  const sec = NAV.find(n => n.k === path[0]);
  if (!sec || !sec.sub.length) return '';
  return `<div class="subnav">${sec.sub.map(([k, l]) => `<a href="#/${sec.k}/${k}" class="${path[1] === k ? 'on' : ''}">${t(l)}</a>`).join('')}</div>`;
}
const wrapPage = (head, body) => `${head}<section><div class="wrap">${body}</div></section>`;
const years = rows => [...new Set(rows.map(r => r.y))].sort((a, b) => b - a);
function listPage(rows, label, { search = true, linkLabel, searchValue = '', searchMatch = '', keyword = '' } = {}) {
  const ys = years(rows);
  const kwFilter = keyword ? `<a class="fchip on kwfilter" href="#/research/publications" data-kw-filter="${esc(keyword)}" aria-label="${esc(t('Remove keyword filter: {x}', { x: kwLabel(keyword) }))}">${esc(kwLabel(keyword))}<span aria-hidden="true">×</span></a>` : '';
  return `<div class="tools" data-list><button class="fchip on" data-y="all">${t('All')}</button>${ys.map(y => `<button class="fchip" data-y="${y}">${y}</button>`).join('')}
    ${kwFilter}${search ? `<input class="search" type="search" value="${esc(searchValue)}"${searchMatch ? ` data-match="${esc(searchMatch)}"` : ''} placeholder="${esc(t('Search {x}…', { x: t(label) }))}" aria-label="${esc(t('Search'))}">` : ''}</div>
    <div id="rows">${rows.map((r, i) => pubRow(r, i, linkLabel, keyword)).join('')}</div><div class="empty" id="none" hidden>${t('No results.')}</div>`;
}
/* Long pages (data/pages.json): image paths are made absolute so they work at any address. */
const prosePage = html => `<div class="prose">${String(html || '').replace(/(src|href)="(img\/)/g, '$1="/$2')}</div>`;
/* "How to reach us": the floor-plan image of Edifici C becomes an interactive 3D model (js/building3d.js). */
const buildingWidget = () => `<figure class="bldg" data-building>
  <div class="bldg-stage"><canvas tabindex="0" role="img" aria-label="${esc(t('3D model of Edifici C. The Optics Group is in C3 Parell, floor 0/−1, half a level below the ground floor. Use the arrow keys to rotate and + / − to zoom.'))}"></canvas>
    <div class="bldg-labels" aria-hidden="true"></div><div class="bldg-tip" hidden></div>
    <div class="bldg-hint" aria-hidden="true">${t('Use Ctrl or ⌘ + scroll to zoom')}</div>
    <noscript><img src="/img/content/696ea6_foto-mapa.png" alt=""></noscript></div>
  <figcaption class="bldg-bar">
    <span class="bldg-key"><i></i>${t('Optics Group')} · ${t('C3 Parell · floor 0/−1')}</span>
    <span class="bldg-btns">
      <button type="button" class="bldg-btn" data-b="us">${t('Show us')}</button>
      <button type="button" class="bldg-btn" data-b="top">${t('Top view')}</button>
      <button type="button" class="bldg-btn" data-b="home">${t('Reset')}</button>
      <button type="button" class="bldg-btn bldg-ico" data-b="out" aria-label="${esc(t('Zoom out'))}">−</button>
      <button type="button" class="bldg-btn bldg-ico" data-b="in" aria-label="${esc(t('Zoom in'))}">+</button>
      <button type="button" class="bldg-btn bldg-ico" data-b="auto" aria-pressed="false" aria-label="${esc(t('Rotate automatically'))}">⟳</button>
    </span>
  </figcaption>
  <p class="bldg-help">${t('Drag to rotate · schematic model, not to scale')}</p>
</figure>`;
const reachPage = () => prosePage(PAGES_HTML.reach).replace(/<img[^>]*foto-mapa[^>]*>/, buildingWidget());
let disposeBuilding = null;
function mountBuilding(root) {
  if (disposeBuilding) { disposeBuilding(); disposeBuilding = null; }
  const el = $('[data-building]', root); if (!el) return;
  const fallback = () => { el.classList.add('bldg-static'); $('.bldg-stage', el).innerHTML = '<img src="/img/content/696ea6_foto-mapa.png" alt="" loading="lazy">'; $('.bldg-btns', el)?.remove(); $('.bldg-help', el)?.remove(); };
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (!gl) return fallback();
  const start = () => import('/js/building3d.js?v=63').then(m => {
    if (!el.isConnected) return;
    disposeBuilding = m.mountBuilding(el, { labels: { us: t('Optics Group'), usSub: t('C3 Parell · floor 0/−1'), names: { 'Central corridor': t('Central corridor'), 'C3B Parell ala': `${t('Optics Group')} · C3 Parell 0/−1` } } });
  }).catch(err => { console.error(err); fallback(); });
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '300px' });
  io.observe(el);
}
/* Editorial notes for the team: only visible with ?preview. */
const flagged = txt => !PREVIEW ? '' : `<div class="note"><b class="mono">${t('Content to confirm · ')}</b>${t(txt)}</div>`;


function newsBanner(items) {
  return `<div class="banner" data-banner aria-roledescription="carousel" aria-label="${t('Featured news')}">
    <div class="bslides">${items.map((n, i) => `<article class="bslide${i ? '' : ' on'}" aria-hidden="${i ? 'true' : 'false'}">
      <div class="bimg">${n.img[0] ? `<img src="${n.img[0]}" alt="" ${i ? 'loading="lazy"' : ''}>` : ''}</div>
      <div class="btxt"><div class="meta"><span class="chip ${n.cat}">${t(n.cat)}</span>${MON[n.m]} ${n.y}</div>
        <h3>${esc(n.title)}</h3><p>${esc((n.text[0] || '').slice(0, 220))}${(n.text[0] || '').length > 220 ? '…' : ''}</p>
        <a class="btn" href="#/news/${newsId(n)}" tabindex="${i ? -1 : 0}">${t('See more')} ${ARR}</a></div></article>`).join('')}</div>
    <div class="bctl"><div class="bdots">${items.map((n, i) => `<button class="bdot${i ? '' : ' on'}" aria-label="${t('News {n}', { n: i + 1 })}"><i></i></button>`).join('')}</div>
      <div class="bnav"><button class="bprev" aria-label="${t('Previous')}">${I_LEFT}</button><button class="bnext" aria-label="${t('Next')}">${I_RIGHT}</button></div></div></div>`;
}
const bannerItems = () => NEWS.filter(n => n.img.length).slice(0, 5);

/* ---------- pages ---------- */
const ROUTES = {
  home() {
    const call = openCalls()[0];
    const events = NEWS.filter(n => n.cat === 'Event').slice(0, 3);
    const pis = PEOPLE.filter(p => p.group === 'Staff').slice(0, 4);
    /* keyword ribbon: keywords shared by at least two publications, in random order on every visit */
    const ribbon = KEYWORDS.filter(x => x.n >= 2).map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const topicLinks = ribbon.map(x => `<a class="pill" href="${esc(kwHref(x.k))}">${esc(x.label)}</a>`).join('');
    const topicCopies = ribbon.map(x => `<span class="pill" aria-hidden="true">${esc(x.label)}</span>`).join('');
    return `<section class="hero"><canvas class="bg"></canvas>
      <div class="wrap"><div class="eyebrow">${esc(SITE.hero_eyebrow)}</div>
      <h1 class="display">${esc(SITE.hero_title)}</h1>
      <p class="lead">${esc(SITE.hero_subtitle)}</p>
      <div class="hero-actions"><a class="btn" href="#/research/lines">${t('Explore our research')} ${ARR}</a><a class="btn btn-ghost" href="#/join">${t('Join us')} ${ARR}</a></div></div>
      <canvas class="dissolve" data-color="#040f20"></canvas></section>
    <nav class="marquee" aria-label="${esc(t('Publication topics'))}"><div class="track" style="--dur:${Math.max(38, ribbon.length * 3.5)}s">${topicLinks}${topicCopies}</div></nav>
    <section class="dark" style="padding-block:60px"><div class="wrap"><div class="stats">
      ${[[PUBS.length, 'Publications listed'], [THESES.length, 'PhD theses'], [PATENTS.length, 'Patents & registrations'], [PEOPLE.length, 'Current members']].map(([n, l]) => `<div class="stat rv"><b data-count="${n}">0</b><span>${t(l)}</span></div>`).join('')}
    </div></div></section>
    <section><div class="wrap"><div class="head"><div><div class="eyebrow">${t('Latest')}</div><h2 class="sec">${t('News')}</h2></div><a class="btn btn-line" href="#/news">${t('All news')} ${ARR}</a></div>
      ${newsBanner(bannerItems())}</div></section>
    <section class="dark grad"><canvas class="bg"></canvas><div class="wrap" style="position:relative"><div class="eyebrow">${t('Research')}</div><h2 class="sec">${t('Two research lines, one shared language')}</h2>
      <div class="grid g2" style="margin-top:34px">${LINES.map((l, i) => `<div class="line rv" style="--i:${i}"><span class="mono">0${i + 1}</span><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p><ul>${l.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>
    <section><div class="wrap"><div class="two" style="grid-template-columns:1fr 1.3fr">
      <div><div class="eyebrow">${t('Events')}</div><h2 class="sec">${t('Recent events')}</h2><p class="lead">${t('Workshops, conferences and visits hosted or attended by the group.')}</p><p style="margin-top:22px"><a class="btn btn-line" href="#/news?cat=Event">${t('All events')} ${ARR}</a></p></div>
      <div>${events.map((n, i) => `<a class="row rv" style="--i:${i};text-decoration:none" href="#/news/${newsId(n)}"><span class="yr">${MON[n.m]} ${n.y}</span><div class="t"><b>${esc(n.title)}</b></div><span class="go">${t('Details')}</span></a>`).join('')}</div></div></div></section>
    <section style="padding-top:0"><div class="wrap"><div class="head"><div><div class="eyebrow">${t('Recent')}</div><h2 class="sec">${t('New publications')}</h2></div><a class="btn btn-line" href="#/research/publications">${t('All publications')} ${ARR}</a></div>
      ${PUBS.slice(0, 4).map((r, i) => pubRow(r, i, 'Paper')).join('')}</div></section>
    <section class="dark"><div class="wrap"><div class="head"><div><div class="eyebrow">${t('People')}</div><h2 class="sec">${t('Meet the team')}</h2></div><a class="btn btn-ghost" href="#/people/current">${t('Full team')} ${ARR}</a></div>
      <div class="grid g4 people">${pis.map(personCard).join('')}</div></div></section>
    <section><div class="wrap"><div class="call"><canvas class="bg"></canvas><div><div class="eyebrow">${t('Join us')}${call ? ` · ${esc(callMeta(call))}` : ''}</div><h2>${call ? esc(call.title) : t('Work with us')}</h2><p>${call ? esc(call.text[0]) : t('Interested in a PhD, a master thesis or a research stay? Get in touch.')}</p></div>
      <div><a class="btn" href="#/join">${t('See opportunities')} ${ARR}</a></div></div></div></section>`;
  },
  research(p, query) {
    const k = p[1] || 'lines', h = key => { const [ti, s] = metaOf(`research/${key}`); return pageHead(p, ti, s, [['Research', '#/research/lines'], [ti]]); };
    if (k === 'publications') return wrapPage(h('publications'), listPage(PUBS, 'publications', {
      linkLabel: 'Paper', searchValue: query.get('search') || '', searchMatch: query.get('match') || '', keyword: query.get('kw') || '',
    }));
    if (k === 'patents') return wrapPage(h('patents'), listPage(PATENTS, 'patents', { linkLabel: 'Link' }));
    if (k === 'theses') return wrapPage(h('theses'), listPage(THESES, 'theses', { linkLabel: 'Thesis' }));
    if (k === 'datasets') return wrapPage(h('datasets'), prosePage(PAGES_HTML.datasets));
    if (k === 'collaborations') return wrapPage(h('collaborations'), prosePage(PAGES_HTML.collaborations));
    return `${h('lines')}<section><div class="wrap"><div class="grid g2">
      ${LINES.map((l, i) => `<div class="line rv" style="--i:${i};background:var(--navy-900);color:#fff"><span class="mono">0${i + 1}</span><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p><ul>${l.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p style="margin-top:34px"><a class="btn" href="#/research/publications">${t('See publications')} ${ARR}</a></p></div></section>`;
  },
  people(p) {
    const k = p[1] || 'current', h = key => { const [ti, s] = metaOf(`people/${key}`, { n: PEOPLE.length }); return pageHead(p, ti, s, [['People', '#/people/current'], [ti]]); };
    const grp = names => names.map(g => { const l = PEOPLE.filter(x => x.group === g); return l.length ? `<div class="grp">${t(g)}</div><div class="grid g4 people">${l.map(personCard).join('')}</div>` : ''; }).join('');
    if (k === 'investigators') return wrapPage(h('investigators'), grp(['Staff']));
    if (k === 'students') return wrapPage(h('students'), grp(['Postdoctoral researchers', 'PhD students']));
    if (k === 'honorary') return wrapPage(h('honorary'), grp(['Emeritus & honorary professors']));
    if (k === 'alumni') return wrapPage(h('alumni'), `<div class="prose formerlist">${FORMER}</div>`);
    return wrapPage(h('current'), grp(['Staff', 'Emeritus & honorary professors', 'Postdoctoral researchers', 'PhD students', 'Associated professors']));
  },
  teaching(p) {
    const k = p[1] || 'courses', h = key => { const [ti, s] = metaOf(`teaching/${key}`); return pageHead(p, ti, s, [['Teaching', '#/teaching/courses'], [ti]]); };
    if (k === 'master-thesis') return wrapPage(h('master-thesis'), listPage(MASTER, 'master theses', { linkLabel: 'Open' }));
    if (k === 'seminars') return wrapPage(h('seminars'), flagged('The current website has no dedicated seminars page. Workshops and events appear in <a href="#/news">News</a>; please provide the seminar listing.') + `<div class="grid g3">${NEWS.filter(n => n.cat === 'Event').map(newsCard).join('')}</div>`);
    return wrapPage(h('courses'), prosePage(PAGES_HTML.courses));
  },
  outreach(p) {
    const k = p[1] || 'activities', h = key => { const [ti, s] = metaOf(`outreach/${key}`); return pageHead(p, ti, s, [['Outreach', '#/outreach/activities'], [ti]]); };
    if (k === 'talks') return wrapPage(h('talks'), prosePage(GENDER_TALKS));
    if (k === 'interviews') return wrapPage(h('interviews'), prosePage(INTERVIEWS));
    if (k === 'gallery') { const all = NEWS.flatMap(n => n.img.map(i => [i, n.title])); return wrapPage(h('gallery'), `<div class="gallery">${all.map(([s, t]) => imageFrame(s, t)).join('')}</div>`); }
    return wrapPage(h('activities'), prosePage(PAGES_HTML.outreach) + `<div class="grp" style="margin-top:50px">${t('Recent outreach news')}</div><div class="grid g3">${NEWS.filter(n => n.cat === 'Outreach' || n.cat === 'Event').slice(0, 6).map(newsCard).join('')}</div>`);
  },
  news(p, query) {
    const id = p[1];
    if (id) {
      const n = NEWS.find(x => newsId(x) === id);
      if (n) return `${pageHead(p, n.title, `${MON[n.m]} ${n.y} · ${t(n.cat)}`, [['News', '#/news'], [n.cat]])}<section><div class="wrap">
        <div class="prose art">${n.text.map((t, k) => `<p${k ? '' : ' class="lead"'}>${esc(t)}</p>`).join('')}${n.link ? `<p><a class="btn" href="${esc(n.link)}" target="_blank" rel="noopener">${t('More information')} ${I_EXT}</a></p>` : ''}</div>
        ${n.img.length ? `<div class="figs" data-n="${n.img.length}">${n.img.map(i => `<figure><img src="${i}" alt="${esc(n.title)}"></figure>`).join('')}</div>` : ''}
        <p class="prose"><a class="inl" href="#/news">${I_LEFT} ${t('All news')}</a></p></div></section>`;
    }
    const cats = [...new Set(NEWS.map(n => n.cat))], ys = years(NEWS);
    const cat = cats.includes(query.get('cat')) ? query.get('cat') : 'all';
    return `${pageHead(p, ...metaOf('news'), [['News']])}<section><div class="wrap">
      ${newsBanner(bannerItems())}<div class="grp" style="margin-top:50px">${t('All news')}</div>
      <div class="tools" data-news data-cat="${esc(cat)}"><button class="fchip${cat === 'all' ? ' on' : ''}" data-c="all">${t('All')}</button>${cats.map(c => `<button class="fchip${cat === c ? ' on' : ''}" data-c="${c}">${t(c)}</button>`).join('')}<span style="flex:1"></span>
      ${selectControl('news-year', t('Year'), [['all', t('All years')], ...ys.map(y => [String(y), String(y)])], 'all', '', 'ui-select-filter')}</div>
      <div class="grid g3" id="newsgrid">${NEWS.map((n, i) => newsCard(n, i % 3).replace('class="card', `data-c="${n.cat}" data-y="${n.y}" class="card`)).join('')}</div><div class="empty" id="none" hidden>${t('No news match.')}</div></div></section>`;
  },
  join(p) {
    const calls = openCalls();
    return `${pageHead(p, ...metaOf('join'), [['Join us']])}<section><div class="wrap">
      <div class="head"><div><div class="eyebrow">${t('Open positions')}</div><h2 class="sec">${t('PhD & postdoc opportunities')}</h2></div></div>
      ${calls.length ? calls.map(n => `<div class="call" style="margin-bottom:24px"><canvas class="bg"></canvas><div><div class="eyebrow">${esc(callMeta(n))}</div><h2>${esc(n.title)}</h2>${n.text.map(p => `<p>${esc(p)}</p>`).join('')}</div><div>${n.link ? `<a class="btn" href="${esc(n.link)}" target="_blank" rel="noopener">${t('Call details')} ${I_EXT}</a>` : `<a class="btn" href="#/contact">${t('Contact us')} ${ARR}</a>`}</div></div>`).join('')
        : `<div class="prose"><p class="lead">${t('There are no open calls right now. New positions are announced here and in News; you can also write to us about upcoming opportunities.')}</p><p><a class="btn btn-line" href="#/contact">${t('Contact us')} ${ARR}</a></p></div>`}
      <div class="grp" style="margin-top:60px">${t('How to apply')}</div>
      <div class="steps">${[['Explore', 'Read our research lines and publications.'], ['Contact', 'Write to a supervisor with your CV and interests.'], ['Apply', 'Submit the official call documentation.'], ['Join', 'Start your project in the group.']].map(([ti, d], i) => `<div class="step rv" style="--i:${i}"><h3>${t('step:' + ti)}</h3><p>${t(d)}</p></div>`).join('')}</div>
      <div class="grp" style="margin-top:60px">${t('FAQ')}</div><div style="max-width:800px">${[['Which programmes can I apply through?', 'Each open call above links to its official programme. In recent years the group has offered projects within PHYNEST, a Horizon Europe MSCA COFUND doctoral programme coordinated by UAB.'], ['Who do I contact?', 'Principal investigators are listed in People; write to them directly about available projects.'], ['Can I do a Master or Bachelor thesis?', 'Yes. See the Teaching section for past master theses and programmes.']].map(([q, a]) => `<details><summary>${t(q)}</summary><p>${t(a)}</p></details>`).join('')}</div>
      <p style="margin-top:40px"><a class="btn" href="#/contact">${t('Contact supervisors')} ${ARR}</a></p></div></section>`;
  },
  about(p) {
    const k = p[1] || 'mission', h = key => { const [ti, s] = metaOf(`about/${key}`); return pageHead(p, ti, s, [['About', '#/about/mission'], [ti]]); };
    if (k === 'funding') return wrapPage(h('funding'), flagged('No funding information on the current website. Please provide projects, grants and logos.'));
    if (k === 'climate') return wrapPage(h('climate'), flagged('The climate-actions page of the current website is empty. Please provide the content.'));
    if (k === 'gender') return wrapPage(h('gender'), prosePage(PAGES_HTML.gender));
    if (k === 'reach') return wrapPage(h('reach'), reachPage());
    return wrapPage(h('mission'), `<div class="prose"><p>${t('The Optics Group is a team of researchers at the Physics Department of the Universitat Autònoma de Barcelona who specialise in the study of light and its applications, spanning classical and quantum optics.')}</p></div>
      <div class="stats" style="margin-top:40px;border-color:var(--line)">${[[PEOPLE.length, 'Members'], [PUBS.length, 'Publications listed'], [THESES.length, 'PhD theses'], [PATENTS.length, 'Patents']].map(([n, l]) => `<div class="stat" style="border-color:var(--line)"><b data-count="${n}">0</b><span style="color:var(--muted)">${t(l)}</span></div>`).join('')}</div>${flagged('A fuller history of the group can be added here.')}`);
  },
  contact(p) {
    return `${pageHead(p, ...metaOf('contact'), [['Contact']])}<section><div class="wrap two">
      <form class="f" id="cform"><label>${t('Name')}<input required name="name" autocomplete="name" maxlength="120"></label><label>${t('Your email')}<input required type="email" name="email" autocomplete="email" maxlength="200"></label>
        <label>${t('Topic')}${selectControl('contact-topic', t('Topic'), ['General', 'PhD / postdoc', 'Collaboration', 'Press'].map(o => [o, t(o)]), 'General', 'topic', 'ui-select-field')}</label><label>${t('Message')}<textarea name="message" rows="5" required maxlength="5000"></textarea></label>
        <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none">
        <button class="btn" type="submit" style="justify-self:start">${t('Send message')} ${ARR}</button><p class="fstatus" role="status" aria-live="polite"></p></form>
      <div class="prose"><h2 style="margin-top:0">${t('Find us')}</h2><p>${t('Physics Department, Facultat de Ciències, Edifici C (C3 Parell, floor 0/−1)')}<br>Universitat Autònoma de Barcelona<br>E-08193 Bellaterra (Cerdanyola del Vallès)</p><p><a class="inl" href="#/about/reach">${t('How to reach us')} ${I_RIGHT}</a></p></div></div></section>`;
  },
};

/* ---------- router ---------- */
const main = $('#main'), header = $('#header');
/* Maintenance switch (panel → "Modo mantenimiento"). Add ?preview to the URL to see the site anyway (PREVIEW, defined above). */
function updateChrome() {
  document.documentElement.lang = LANG;
  const meta = $('meta[name="description"]'); if (meta) meta.content = DESC[LANG] || DESC.en;
  $$('[data-i18n]').forEach(el => { el.dataset.i18nSource ||= el.textContent; el.textContent = t(el.dataset.i18nSource); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('#lang-label').textContent = t('Language');
  $('#lang-current').textContent = LANGS.find(([code]) => code === LANG)[2];
  $('#lang-menu').innerHTML = LANGS.map(([code, label, short]) => `<button class="lang-option" type="button" role="menuitemradio" data-lang="${code}" aria-checked="${code === LANG}" tabindex="${code === LANG ? 0 : -1}">${label} (${short})</button>`).join('');
  $('#nav').innerHTML = NAV.map(n => `<div><a class="top" data-k="${n.k}" href="#/${n.k}${n.sub[0] ? '/' + n.sub[0][0] : ''}">${t(n.l)}</a>${n.sub.length ? `<div class="drop">${n.sub.map(([k, l]) => `<a href="#/${n.k}/${k}">${t(l)}</a>`).join('')}</div>` : ''}</div>`).join('');
  $('#footlinks').innerHTML = NAV.map(n => `<a href="#/${n.k}${n.sub[0] ? '/' + n.sub[0][0] : ''}">${t(n.l)}</a>`).join('');
  $('#footbrand').textContent = t('Optics Group · UAB');
  $('#footaddress').innerHTML = `${t('Physics Department, Facultat de Ciències, Edifici C')}<br>Universitat Autònoma de Barcelona<br>E-08193 Bellaterra`;
  $('#footlegal').textContent = t('Optics Group UAB');
  linkify(header); linkify($('.site-footer'));
}
function showLoadError() {
  main.innerHTML = `<section><div class="wrap"><h1>${t('Content could not be loaded')}</h1><p>${t('Please reload the page in a few seconds.')}</p></div></section>`;
}
function renderMaintenance() {
  document.body.classList.add('maint');
  document.title = `${MAINT.title || t('Under maintenance')} · ${t('Optics Group · UAB')}`;
  main.innerHTML = `<section class="maint-screen"><canvas class="bg"></canvas>
    <div class="maint-box"><canvas class="gears" role="img" aria-label="${t('Animated gears and wrench')}"></canvas>
    <div class="eyebrow">${t('Optics Group · Universitat Autònoma de Barcelona')}</div>
    <h1>${esc(MAINT.title || t('Under maintenance'))}</h1>
    ${paras(MAINT.message || 'We are improving the website. Please come back soon.').map(t => `<p class="lead">${esc(t)}</p>`).join('')}</div></section>`;
  $$('canvas.bg', main).forEach(c => startBackground(c, { size: 34 }));
  $$('canvas.gears', main).forEach(startGears);
}
/* ---------- addresses ----------
   Pages live at real addresses (/research/publications, /es/news/…); templates write internal links as "#/path" and
   linkify() turns them into real addresses for the current language. Old "#/…" links are redirected on load. */
const pagePath = (path, lang = LANG) => `${LANG_PREFIX[lang]}/${path ? `${path}/` : ''}`;
const toUrl = (route, lang = LANG) => {
  const [path, query = ''] = String(route).replace(/^#?\/?/, '').split('?');
  const params = new URLSearchParams(query); params.delete('preview');
  let qs = params.toString();
  if (PREVIEW) qs = qs ? `${qs}&preview` : 'preview';
  return pagePath(path.replace(/\/+$/, ''), lang) + (qs ? `?${qs}` : '');
};
function linkify(root) {
  $$('a[href^="#/"]', root).forEach(a => a.setAttribute('href', toUrl(a.getAttribute('href'))));
}
/* Current route: path segments without the language prefix, and the query. */
function currentRoute() {
  const path = location.pathname.replace(/^\/(es|ca)(?=\/|$)/, '').replace(/\/index\.html$/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { path, query: new URLSearchParams(location.search) };
}
/* Closest news item to an address that no longer exists (e.g. after its title was corrected). */
function similarNews(id) {
  const words = x => new Set(x.split('-').filter(w => w.length > 2 && !/^\d+$/.test(w)));
  const want = words(id), prefix = id.split('-').slice(0, 2).join('-');
  let best = null, score = 0;
  NEWS.forEach(n => {
    const nid = newsId(n), have = words(nid);
    const common = [...want].filter(w => have.has(w)).length / Math.max(1, Math.min(want.size, have.size));
    const s = common + (nid.startsWith(prefix + '-') ? 0.25 : 0);
    if (s > score) { score = s; best = n; }
  });
  return score >= 0.75 ? best : null;
}
/* Decide what an address shows: a page, a redirect (alias, renamed news, draft) or "not found". */
function resolve({ path, query }) {
  const [sec = '', sub = ''] = path;
  if (!sec) return { key: 'home', path };
  if (path.length === 1 && SECTION_HOME[sec]) return { redirect: SECTION_HOME[sec] };
  if (sec === 'news' && sub) {
    if (path.length > 2) return { notFound: true };
    if (NEWS.some(n => newsId(n) === sub)) return { key: 'news', path };
    const near = similarNews(sub);
    return near ? { redirect: `news/${newsId(near)}` } : { notFound: true };
  }
  const page = path.join('/');
  if (!PAGE_META[page]) return { notFound: true };
  if (isDraftPath(page, PREVIEW)) return { redirect: SECTION_HOME[sec] || '' };
  return { key: sec, path };
}
function notFoundPage() {
  return `<header class="phead"><canvas class="bg"></canvas><div class="wrap"><div class="eyebrow">404</div><h1>${t('Page not found')}</h1>
    <p class="lead">${t('The address may have changed or the page no longer exists.')}</p></div><canvas class="dissolve" data-color="#f4f7fb"></canvas></header>
    <section><div class="wrap"><p><a class="btn" href="#/">${t('Home')} ${ARR}</a> <a class="btn btn-line" href="#/news">${t('All news')} ${ARR}</a> <a class="btn btn-line" href="#/contact">${t('Contact us')} ${ARR}</a></p></div></section>`;
}
/* Head tags that change from page to page (the static copies written by tools/build-pages.mjs carry them too). */
function setHead(title, description, canonicalRoute) {
  document.title = title;
  let meta = $('meta[name="description"]');
  if (!meta) { meta = Object.assign(document.createElement('meta'), { name: 'description' }); document.head.appendChild(meta); }
  meta.content = description;
  $$('link[rel="canonical"], link[rel="alternate"][hreflang], meta[name="robots"]').forEach(el => el.remove());
  if (canonicalRoute === null) { document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' })); return; }
  const add = (rel, href, hreflang) => document.head.appendChild(Object.assign(document.createElement('link'), { rel, href }, hreflang ? { hreflang } : {}));
  add('canonical', SITE_URL + pagePath(canonicalRoute));
  LANGS.forEach(([code]) => add('alternate', SITE_URL + pagePath(canonicalRoute, code), code));
  add('alternate', SITE_URL + pagePath(canonicalRoute, 'en'), 'x-default');
}
function render() {
  if (MAINT.enabled && !PREVIEW) return renderMaintenance();
  document.body.classList.remove('maint');
  const route = currentRoute(), r = resolve(route);
  if (r.redirect !== undefined) {
    history.replaceState(history.state, '', toUrl(`${r.redirect}?${route.query}`));
    return render();
  }
  const key = r.notFound ? 'notfound' : r.key;
  main.innerHTML = `<div class="pg">${r.notFound ? notFoundPage() : ROUTES[key](r.path || [], route.query)}</div>`;
  updateChrome();
  linkify(main);
  $$('.nav a.top').forEach(a => a.classList.toggle('on', a.dataset.k === key));
  const h1 = main.querySelector('h1')?.textContent.trim();
  const lead = main.querySelector('.phead .lead, .hero .lead')?.textContent.trim();
  const site = t('Optics Group · UAB');
  setHead(key === 'home' || !h1 ? site : `${h1} · ${site}`, (key !== 'home' && lead) || DESC[LANG] || DESC.en,
    r.notFound ? null : route.path.join('/'));
  document.documentElement.toggleAttribute('data-notfound', !!r.notFound);
  const y = history.state && typeof history.state.y === 'number' ? history.state.y : 0;
  scrollTo({ top: y, behavior: 'instant' });
  closeMenu(); mount(main);
}
/* In-site navigation without reloading the page. */
function navigate(url, { replace = false } = {}) {
  history.replaceState({ ...(history.state || {}), y: scrollY }, '');
  const next = new URL(url, location.href);
  const nextLang = langOfPath(next.pathname);
  if (replace) history.replaceState({ y: 0 }, '', next.pathname + next.search + next.hash);
  else history.pushState({ y: 0 }, '', next.pathname + next.search + next.hash);
  if (nextLang !== LANG) { LANG = nextLang; MON = MONTHS[LANG]; updateChrome(); loadData().then(render).catch(err => { console.error(err); showLoadError(); }); }
  else render();
}
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return; /* in-page anchor (#main) */
  e.preventDefault();
  navigate(url.href);
});
addEventListener('popstate', () => {
  const lang = langOfPath(location.pathname);
  if (lang !== LANG) { LANG = lang; MON = MONTHS[LANG]; updateChrome(); loadData().then(render).catch(err => { console.error(err); showLoadError(); }); }
  else render();
});
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function mount(root) {
  $$('canvas.bg', root).forEach(c => startBackground(c, { size: c.closest('.call') ? 26 : 34 }));
  $$('canvas.dissolve', root).forEach(dissolve);
  initPhotoReveals(root);
  /* reveal on scroll; once shown, the reveal classes are removed so the element's own hover effects and transitions apply */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; io.unobserve(el); el.classList.add('in');
    const delay = REDUCED ? 0 : 850 + (parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0) * 70;
    setTimeout(() => el.classList.remove('rv', 'in'), delay);
  }), { threshold: .12 });
  $$('.rv', root).forEach(el => io.observe(el));
  const cio = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; cio.unobserve(e.target); counter(e.target); }));
  $$('[data-count]', root).forEach(el => cio.observe(el));
  banner(root);
  $$('.figs', root).forEach(g => {
    const imgs = $$('img', g);
    imgs.forEach(i => {
      const fit = () => {
        const r = i.naturalWidth / i.naturalHeight, f = i.parentElement;
        if (imgs.length === 1 || r > 2.4) { f.style.flex = '1 1 100%'; f.style.maxWidth = i.naturalWidth + 'px'; f.style.margin = '0 auto'; }
        else f.style.flex = `${r} 1 ${Math.round(r * 260)}px`;
      };
      i.complete ? fit() : i.addEventListener('load', fit, { once: true });
    });
  });
  $$('.tilt', root).forEach(tilt);
  $$('.marquee a.pill', root).forEach(link => link.addEventListener('focus', () => link.scrollIntoView({ block: 'nearest', inline: 'nearest' })));
  const lst = $('[data-list]', root);
  if (lst) {
    const input = $('.search', lst);
    const params = new URLSearchParams(location.search);
    const syncSearch = currentRoute().path.join('/') === 'research/publications';
    let y = 'all', q = (input?.value || '').trim().toLowerCase(), match = (input?.dataset.match || '').trim().toLowerCase();
    const kw = $('[data-kw-filter]', lst)?.dataset.kwFilter || '';
    const apply = () => { let n = 0; $$('#rows .row').forEach(r => { const text = r.textContent.toLowerCase(); const queryMatch = !q || text.includes(q) || (!!match && text.includes(match)); const kwMatch = !kw || (r.dataset.kw || '').split('|').includes(kw); const ok = (y === 'all' || r.firstElementChild.textContent === y) && queryMatch && kwMatch; r.hidden = !ok; n += ok; }); $('#none').hidden = n > 0; };
    lst.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('.fchip', lst).forEach(x => x.classList.toggle('on', x === b)); y = b.dataset.y; apply(); });
    input?.addEventListener('input', e => {
      const value = e.target.value.trim();
      q = value.toLowerCase();
      match = '';
      e.target.removeAttribute('data-match');
      if (syncSearch) {
        if (value) params.set('search', value); else params.delete('search');
        params.delete('match');
        const queryString = params.toString().replace(/(^|&)preview=(?=&|$)/, '$1preview');
        history.replaceState(history.state, '', `${location.pathname}${queryString ? `?${queryString}` : ''}`);
      }
      apply();
    });
    apply();
  }
  const nl = $('[data-news]', root);
  if (nl) {
    let c = nl.dataset.cat || 'all', y = 'all';
    const apply = () => { let n = 0; $$('#newsgrid .card').forEach(el => { const ok = (c === 'all' || el.dataset.c === c) && (y === 'all' || el.dataset.y === y); el.hidden = !ok; n += ok; }); $('#none').hidden = n > 0; };
    if (c !== 'all') apply();
    nl.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('.fchip', nl).forEach(x => x.classList.toggle('on', x === b)); c = b.dataset.c; apply(); });
    $('[data-ui-select-value]', nl)?.addEventListener('change', e => { y = e.target.value; apply(); });
  }
  $('#cform', root)?.addEventListener('submit', sendContact);
  mountBuilding(root);
}

function banner(root) {
  const b = $('[data-banner]', root); if (!b) return;
  const sl = $$('.bslide', b), dots = $$('.bdot', b), N = sl.length, T = 6500;
  let i = 0, timer = null, paused = false;
  const go = k => {
    i = (k + N) % N;
    sl.forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j !== i); $('a', s).tabIndex = j === i ? 0 : -1; });
    dots.forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.remove('run'); });
    void b.offsetWidth;
    if (!REDUCED && !paused) dots[i].classList.add('run');
    clearTimeout(timer);
    if (!REDUCED && !paused) timer = setTimeout(() => go(i + 1), T);
  };
  $('.bprev', b).onclick = () => go(i - 1);
  $('.bnext', b).onclick = () => go(i + 1);
  dots.forEach((d, j) => d.onclick = () => go(j));
  const pause = v => { paused = v; go(i); };
  b.addEventListener('pointerenter', () => pause(true));
  b.addEventListener('pointerleave', () => pause(false));
  b.addEventListener('focusin', () => pause(true));
  b.addEventListener('focusout', () => pause(false));
  let x0 = null;
  b.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  b.addEventListener('touchend', e => { if (x0 === null) return; const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); x0 = null; });
  const vis = new IntersectionObserver(es => pause(!es[0].isIntersecting)); vis.observe(b);
  go(0);
}
function counter(el) {
  const to = +el.dataset.count; if (REDUCED) { el.textContent = to; return; }
  const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
}
function tilt(el) {
  if (REDUCED || matchMedia('(hover:none)').matches) return;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(900px) rotateX(${-y * 4}deg) rotateY(${x * 5}deg) translateY(-6px)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}
function magnet(el) {
  if (REDUCED || matchMedia('(hover:none)').matches) return;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.translate = `${(e.clientX - r.left - r.width / 2) * .15}px ${(e.clientY - r.top - r.height / 2) * .25}px`; });
  el.addEventListener('pointerleave', () => { el.style.translate = ''; });
}
async function sendContact(e) {
  e.preventDefault();
  const f = e.target, btn = $('button[type="submit"]', f), st = $('.fstatus', f), d = Object.fromEntries(new FormData(f));
  if (d.botcheck) return;
  const say = (msg, ok) => { st.textContent = msg; st.dataset.ok = ok ? '1' : '0'; };
  if (!CONTACT_FORM_KEY) { say(t('The contact form is not available yet. Please try again later.'), false); return; }
  btn.disabled = true; say(t('Sending…'), true);
  try {
    const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: CONTACT_FORM_KEY, subject: `[opticsuab.eu] ${d.topic}: message from ${d.name}`, from_name: 'Optics Group website', name: d.name, email: d.email, replyto: d.email, topic: d.topic, message: d.message }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.message || r.status);
    f.reset(); say(t('Thank you! Your message has been sent. We will reply to your email.'), true);
  } catch (err) { console.error(err); say(t('Sorry, the message could not be sent. Please try again in a few minutes.'), false); }
  finally { btn.disabled = false; }
}
function toast(msg) { let t = $('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' })); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }

/* ---------- shell ---------- */
updateChrome();
$('#year').textContent = new Date().getFullYear();
const closeMenu = () => { $('#nav').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); header.classList.remove('menu'); };
const langPicker = $('#lang-picker'), langTrigger = $('#lang-trigger'), langMenu = $('#lang-menu');
const closeLanguageMenu = (restoreFocus = false) => {
  langPicker.classList.remove('open');
  langTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) langTrigger.focus();
};
const openLanguageMenu = () => {
  langPicker.classList.add('open');
  langTrigger.setAttribute('aria-expanded', 'true');
  $('[role="menuitemradio"][aria-checked="true"]', langMenu)?.focus();
};
langTrigger.addEventListener('click', () => {
  if (langPicker.classList.contains('open')) closeLanguageMenu();
  else openLanguageMenu();
});
langTrigger.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  openLanguageMenu();
});
langMenu.addEventListener('keydown', e => {
  const options = $$('[role="menuitemradio"]', langMenu), index = options.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    options[(index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    options[e.key === 'Home' ? 0 : options.length - 1]?.focus();
  }
});
langMenu.addEventListener('click', async e => {
  const option = e.target.closest('[data-lang]');
  if (!option) return;
  const nextLang = option.dataset.lang;
  closeLanguageMenu(true);
  if (nextLang === LANG) return;
  try { localStorage.setItem('lang', nextLang); } catch (e) { /* the address keeps the choice anyway */ }
  const { path, query } = currentRoute();
  navigate(toUrl(`${path.join('/')}?${query}`, nextLang));
});
langPicker.addEventListener('focusout', e => { if (!langPicker.contains(e.relatedTarget)) closeLanguageMenu(); });
document.addEventListener('click', e => { if (!langPicker.contains(e.target)) closeLanguageMenu(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && langPicker.classList.contains('open')) {
    e.preventDefault();
    closeLanguageMenu(true);
  }
});
const closeUiSelect = (control, restoreFocus = false) => {
  control.classList.remove('open');
  const trigger = $('[data-ui-select-trigger]', control);
  trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger?.focus();
};
const closeUiSelects = (except = null) => {
  $$('[data-ui-select].open').forEach(control => { if (control !== except) closeUiSelect(control); });
};
const syncUiSelect = (control, value, notify = false) => {
  const options = $$('.ui-select-option', control);
  const selected = options.find(option => option.dataset.value === String(value));
  const input = $('[data-ui-select-value]', control), current = $('[data-ui-select-current]', control);
  if (!selected || !input || !current) return;
  input.value = selected.dataset.value;
  current.textContent = selected.textContent;
  $('[data-ui-select-trigger]', control)?.setAttribute('aria-label', `${control.dataset.label}: ${selected.textContent}`);
  options.forEach(option => {
    const checked = option === selected;
    option.setAttribute('aria-checked', String(checked));
    option.tabIndex = checked ? 0 : -1;
  });
  if (notify) input.dispatchEvent(new Event('change', { bubbles: true }));
};
const openUiSelect = control => {
  closeUiSelects(control);
  const trigger = $('[data-ui-select-trigger]', control);
  const options = $$('.ui-select-option', control);
  const selected = options.find(option => option.getAttribute('aria-checked') === 'true') || options[0];
  if (!trigger || !selected) return;
  control.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
  options.forEach(option => { option.tabIndex = option === selected ? 0 : -1; });
  requestAnimationFrame(() => { if (control.isConnected && control.classList.contains('open')) selected.focus(); });
};
document.addEventListener('click', e => {
  const target = e.target instanceof Element ? e.target : null;
  const option = target?.closest('[data-ui-select-option]');
  if (option) {
    const control = option.closest('[data-ui-select]');
    syncUiSelect(control, option.dataset.value, true);
    closeUiSelect(control, true);
    return;
  }
  const trigger = target?.closest('[data-ui-select-trigger]');
  if (trigger) {
    const control = trigger.closest('[data-ui-select]');
    if (control.classList.contains('open')) closeUiSelect(control);
    else openUiSelect(control);
    return;
  }
  closeUiSelects();
});
document.addEventListener('focusin', e => {
  const control = e.target instanceof Element ? e.target.closest('[data-ui-select]') : null;
  closeUiSelects(control);
});
document.addEventListener('keydown', e => {
  const target = e.target instanceof Element ? e.target : null;
  const trigger = target?.closest('[data-ui-select-trigger]');
  const option = target?.closest('[data-ui-select-option]');
  if (trigger && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    openUiSelect(trigger.closest('[data-ui-select]'));
    return;
  }
  if (option) {
    const control = option.closest('[data-ui-select]'), options = $$('.ui-select-option', control), index = options.indexOf(option);
    if (e.key === 'Escape') {
      e.preventDefault();
      closeUiSelect(control, true);
      return;
    }
    let next = -1;
    if (e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      options.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; });
      options[next].focus();
    }
    return;
  }
  if (e.key === 'Escape') {
    const open = $('[data-ui-select].open');
    if (open) { e.preventDefault(); closeUiSelect(open, true); }
  }
});
document.addEventListener('reset', e => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  requestAnimationFrame(() => {
    if (e.defaultPrevented) return;
    $$('[data-ui-select]', form).forEach(control => {
      const input = $('[data-ui-select-value]', control);
      if (input) syncUiSelect(control, input.dataset.defaultValue ?? input.value);
    });
  });
});
$('#burger').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); header.classList.toggle('menu', o); });
$('#nav').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
addEventListener('scroll', () => {
  header.classList.toggle('solid', scrollY > 40);
  $('#progress').style.transform = `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
}, { passive: true });
/* Old addresses: "#/news/…" (before 1 Nov 2026) and "?lang=es" become real addresses; a visitor who chose a language
   before lands on it when arriving at an English address. */
(() => {
  const q = new URLSearchParams(location.search);
  let lang = LANG, route = null;
  const ql = q.get('lang');
  if (ql && ql in LANG_PREFIX) { lang = ql; q.delete('lang'); route = currentRoute().path.join('/'); }
  if (location.hash.startsWith('#/')) route = location.hash.slice(2);
  else if (route !== null) route += `?${q}`;
  if (route === null && LANG === 'en' && location.pathname === '/' && !document.referrer.startsWith(location.origin)) {
    let saved = null; try { saved = localStorage.getItem('lang'); } catch (e) { /* storage blocked */ }
    if (saved && saved !== 'en' && saved in LANG_PREFIX) { lang = saved; route = `${currentRoute().path.join('/')}?${q}`; }
  }
  if (route === null) return;
  LANG = lang; MON = MONTHS[LANG];
  history.replaceState(null, '', toUrl(route, lang));
})();
loadData().then(render).catch(err => {
  console.error(err);
  showLoadError();
});
