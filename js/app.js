const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ARR = '<span class="arr">→</span>';

const NAV = [
  { k: 'research', l: 'Research', sub: [['lines', 'Research lines'], ['publications', 'Publications'], ['patents', 'Patents'], ['theses', 'PhD theses'], ['datasets', 'Datasets & software'], ['collaborations', 'Collaborations']] },
  { k: 'people', l: 'People', sub: [['current', 'Current team'], ['investigators', 'Principal investigators'], ['students', 'PhD students & postdocs'], ['alumni', 'Former members'], ['honorary', 'Honorary professors']] },
  { k: 'teaching', l: 'Teaching', sub: [['courses', 'Courses'], ['master-thesis', 'Master theses'], ['seminars', 'Seminars & summer schools']] },
  { k: 'outreach', l: 'Outreach', sub: [['activities', 'Activities & workshops'], ['talks', 'Talks'], ['interviews', 'Interviews & press'], ['gallery', 'Photo gallery']] },
  { k: 'news', l: 'News', sub: [] },
  { k: 'join', l: 'Join us', sub: [] },
  { k: 'about', l: 'About', sub: [['mission', 'Mission & history'], ['funding', 'Funding & grants'], ['climate', 'Climate commitment'], ['gender', 'Gender & equality'], ['reach', 'How to reach us']] },
];
/* Contact form: messages are delivered by Web3Forms to the group mailbox (address not shown on the site). */
const CONTACT_FORM_KEY = '';
let MAINT = { enabled: false };
let SITE = { hero_eyebrow: '', hero_title: '', hero_subtitle: '', topics: [], research_lines: [] }, TOPICS = [], LINES = [];
/* ---------- data (edited from the Pages CMS panel, stored in /data/*.json) ---------- */
let NEWS = [], PEOPLE = [], PUBS = [], THESES = [], PATENTS = [], MASTER = [], FORMER = '', INTERVIEWS = '', GENDER_TALKS = '', PAGES_HTML = {};
const paras = t => String(t || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
const asList = v => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const byYear = rows => rows.map(r => ({ y: +r.year || 0, t: r.text || '', u: r.link || null })).sort((a, b) => b.y - a.y);
async function loadData() {
  const get = f => fetch(`data/${f}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f + ': ' + r.status); return r.json(); });
  MAINT = await get('maintenance').catch(() => ({ enabled: false }));
  if (MAINT.enabled && !PREVIEW) return;
  const [news, people, pubs, theses, patents, master, former, pages, site] = await Promise.all(
    ['news', 'people', 'publications', 'theses', 'patents', 'master-theses', 'former-members', 'pages', 'site'].map(get));
  SITE = Object.assign(SITE, site);
  TOPICS = asList(SITE.topics);
  LINES = asList(SITE.research_lines).map(l => ({ t: l.title || '', d: l.description || '', tags: asList(l.tags) }));
  NEWS = (news.news || []).filter(n => n && n.title).map(n => {
    const [y, m] = String(n.date || '').split('-').map(Number);
    return { y: y || 0, m: m || 1, cat: n.category || 'News', title: n.title, text: paras(n.text), img: asList(n.images), link: n.link || '' };
  }).sort((a, b) => (b.y - a.y) || (b.m - a.m));
  PEOPLE = (people.people || []).filter(p => p && p.name).map(p => ({
    name: p.name, group: p.group, pos: p.position, office: p.office, mail: p.email, photo: p.photo, bio: p.summary,
    about: paras(p.about).length ? paras(p.about) : null, status: p.status,
    scholar: p.scholar, orcid: p.orcid, scopus: p.scopus, wos: p.wos, rid: p.researcherid, linkedin: p.linkedin, web: p.web }));
  PUBS = byYear(pubs.publications || []); THESES = byYear(theses.theses || []); PATENTS = byYear(patents.patents || []); MASTER = byYear(master.master_theses || []);
  FORMER = (former.groups || []).map(g => `<h2>${esc(g.title)}</h2>${asList(g.names).map(n => `<h3 class="yr">${esc(n)}</h3>`).join('\n')}`).join('\n');
  INTERVIEWS = pages.interviews || ''; GENDER_TALKS = pages.talks || '';
  PAGES_HTML = { outreach: pages.outreach, reach: pages.how_to_reach_us, gender: pages.gender, collaborations: pages.collaborations, links: pages.links, societies: pages.societies, courses: pages.courses, datasets: pages.datasets };
}
const initials = n => n.replace(/^Dr\.\s*/, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');
const newsId = n => `${n.y}-${n.m}-${n.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

/* ---------- pieces ---------- */
const pxImg = (src, alt = '') => `<div class="pxi"><img src="${src}" alt="${esc(alt)}" loading="lazy"></div>`;
const newsCard = (n, i = 0) => {
  const sum = (n.text[0] || '').slice(0, 150) + ((n.text[0] || '').length > 150 ? '…' : '');
  return `<a class="card rv tilt" style="--i:${i}" href="#/news/${newsId(n)}">
    ${n.img[0] ? pxImg(n.img[0], n.title) : '<div class="noimg"></div>'}
    <div class="body"><div class="meta"><span class="chip ${n.cat}">${n.cat}</span>${MON[n.m]} ${n.y}</div><h3>${esc(n.title)}</h3><p>${esc(sum)}</p><span class="more">Read more ${ARR}</span></div></a>`;
};
const personCard = (p, i = 0) => `<article class="person rv" style="--i:${i % 8}" data-p="${PEOPLE.indexOf(p)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(p.name)}: view profile">
  ${p.photo ? pxImg(p.photo, '') : `<div class="noph">${esc(initials(p.name))}</div>`}
  <div class="body"><h3>${esc(p.name)}</h3><div class="meta">${esc(p.pos || p.group)}${p.office ? ' · ' + esc(p.office) : ''}</div>
  ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}<span class="more">View profile ${ARR}</span></div></article>`;
const LINKS = [['linkedin', 'LinkedIn'], ['scholar', 'Google Scholar'], ['orcid', 'ORCID'], ['scopus', 'Scopus'], ['wos', 'Web of Science'], ['rid', 'ResearcherID'], ['web', 'Website']];
const profile = p => `<header class="pm-head"><div class="pm-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<div class="noph">${esc(initials(p.name))}</div>`}</div>
  <div class="pm-id"><div class="eyebrow">${esc(p.group)}</div><h2 id="pm-t">${esc(p.name)}</h2>
  <div class="meta">${esc(p.pos || '')}${p.office ? ' · Office ' + esc(p.office) : ''}</div>
  ${p.status ? `<span class="chip Event">${esc(p.status)}</span>` : ''}</div></header>
  <div class="pm-body">${(p.about || (p.bio ? [p.bio] : [])).map(t => `<p>${esc(t)}</p>`).join('')}
  <div class="pm-links">${p.mail ? `<a class="btn" href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : ''}${LINKS.filter(([k]) => p[k]).map(([k, l]) => `<a class="btn btn-line" href="${esc(p[k])}" target="_blank" rel="noopener">${l} ↗</a>`).join('')}</div></div>`;
let pmLast;
const openProfile = el => {
  const p = PEOPLE[+el.dataset.p]; if (!p) return;
  let d = $('#pm'); if (!d) { d = document.createElement('dialog'); d.id = 'pm'; d.setAttribute('aria-labelledby', 'pm-t'); document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('.pm-x')) d.close(); }); d.addEventListener('close', () => pmLast && pmLast.focus()); }
  pmLast = el; d.innerHTML = `<button class="pm-x" aria-label="Close">×</button><div class="pm">${profile(p)}</div>`; d.showModal();
};
document.addEventListener('click', e => { const c = e.target.closest('.person[data-p]'); if (c) openProfile(c); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.person[data-p]')) { e.preventDefault(); openProfile(e.target); } });
const pubRow = (r, i = 0, label) => `<div class="row rv" style="--i:${i % 6}"><span class="yr">${r.y}</span>
  <div class="t">${esc(r.t)}</div>${r.u ? `<a class="go" href="${esc(r.u)}" target="_blank" rel="noopener">${label || 'Open'} ↗</a>` : '<span></span>'}</div>`;
const pageHead = (path, title, sub, crumbs) => `<header class="phead"><canvas class="bg"></canvas>
  <div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>${crumbs.map(c => `<span>/</span>${c[1] ? `<a href="${c[1]}">${c[0]}</a>` : `<span>${c[0]}</span>`}`).join('')}</nav>
  <h1>${esc(title)}</h1>${sub ? `<p class="lead">${esc(sub)}</p>` : ''}${subnav(path)}</div>
  <canvas class="dissolve" data-color="#f4f7fb"></canvas></header>`;
function subnav(path) {
  const sec = NAV.find(n => n.k === path[0]);
  if (!sec || !sec.sub.length) return '';
  return `<div class="subnav">${sec.sub.map(([k, l]) => `<a href="#/${sec.k}/${k}" class="${path[1] === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
}
const wrapPage = (head, body) => `${head}<section><div class="wrap">${body}</div></section>`;
const years = rows => [...new Set(rows.map(r => r.y))].sort((a, b) => b - a);
function listPage(rows, label, { search = true, linkLabel } = {}) {
  const ys = years(rows);
  return `<div class="tools" data-list><button class="fchip on" data-y="all">All</button>${ys.map(y => `<button class="fchip" data-y="${y}">${y}</button>`).join('')}
    ${search ? '<input class="search" type="search" placeholder="Search ' + label + '…" aria-label="Search">' : ''}</div>
    <div id="rows">${rows.map((r, i) => pubRow(r, i, linkLabel)).join('')}</div><div class="empty" id="none" hidden>No results.</div>`;
}
const prosePage = html => `<div class="prose">${html}</div>`;
const flagged = txt => `<div class="note"><b class="mono">Content to confirm · </b>${txt}</div>`;


function newsBanner(items) {
  return `<div class="banner" data-banner aria-roledescription="carousel" aria-label="Featured news">
    <div class="bslides">${items.map((n, i) => `<article class="bslide${i ? '' : ' on'}" aria-hidden="${i ? 'true' : 'false'}">
      <div class="bimg">${n.img[0] ? `<img src="${n.img[0]}" alt="" ${i ? 'loading="lazy"' : ''}>` : ''}</div>
      <div class="btxt"><div class="meta"><span class="chip ${n.cat}">${n.cat}</span>${MON[n.m]} ${n.y}</div>
        <h3>${esc(n.title)}</h3><p>${esc((n.text[0] || '').slice(0, 220))}${(n.text[0] || '').length > 220 ? '…' : ''}</p>
        <a class="btn" href="#/news/${newsId(n)}" tabindex="${i ? -1 : 0}">See more ${ARR}</a></div></article>`).join('')}</div>
    <div class="bctl"><div class="bdots">${items.map((n, i) => `<button class="bdot${i ? '' : ' on'}" aria-label="News ${i + 1}"><i></i></button>`).join('')}</div>
      <div class="bnav"><button class="bprev" aria-label="Previous">←</button><button class="bnext" aria-label="Next">→</button></div></div></div>`;
}
const bannerItems = () => NEWS.filter(n => n.img.length).slice(0, 5);

/* ---------- pages ---------- */
const ROUTES = {
  home() {
    const phd = NEWS.find(n => /Open PhD/i.test(n.title));
    const events = NEWS.filter(n => n.cat === 'Event').slice(0, 3);
    const pis = PEOPLE.filter(p => p.group === 'Staff').slice(0, 4);
    return `<section class="hero"><canvas class="bg"></canvas>
      <div class="wrap"><div class="eyebrow">${esc(SITE.hero_eyebrow)}</div>
      <h1 class="display">${esc(SITE.hero_title)}</h1>
      <p class="lead">${esc(SITE.hero_subtitle)}</p>
      <div class="hero-actions"><a class="btn" href="#/research/publications">Explore our research ${ARR}</a><a class="btn btn-ghost" href="#/join">Join us ${ARR}</a></div></div>
      <canvas class="dissolve" data-color="#040f20"></canvas></section>
    <div class="marquee" aria-hidden="true"><div class="track">${[...TOPICS, ...TOPICS].map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div></div>
    <section class="dark" style="padding-block:60px"><div class="wrap"><div class="stats">
      ${[[PUBS.length, 'Publications listed'], [THESES.length, 'PhD theses'], [PATENTS.length, 'Patents & registrations'], [PEOPLE.length, 'Current members']].map(([n, l]) => `<div class="stat rv"><b data-count="${n}">0</b><span>${l}</span></div>`).join('')}
    </div></div></section>
    <section><div class="wrap"><div class="head"><div><div class="eyebrow">Latest</div><h2 class="sec">News</h2></div><a class="btn btn-line" href="#/news">All news ${ARR}</a></div>
      ${newsBanner(bannerItems())}</div></section>
    <section class="dark grad"><canvas class="bg"></canvas><div class="wrap" style="position:relative"><div class="eyebrow">Research</div><h2 class="sec">Two research lines, one shared language</h2>
      <div class="grid g2" style="margin-top:34px">${LINES.map((l, i) => `<div class="line rv" style="--i:${i}"><span class="mono">0${i + 1}</span><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p><ul>${l.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p style="margin-top:30px"><a class="btn btn-ghost" href="#/research/lines">Research lines ${ARR}</a></p></div></section>
    <section><div class="wrap"><div class="two" style="grid-template-columns:1fr 1.3fr">
      <div><div class="eyebrow">Events</div><h2 class="sec">What's happening</h2><p class="lead">Workshops, conferences and visits hosted or attended by the group.</p><p style="margin-top:22px"><a class="btn btn-line" href="#/news">See the calendar ${ARR}</a></p></div>
      <div>${events.map((n, i) => `<a class="row rv" style="--i:${i};text-decoration:none" href="#/news/${newsId(n)}"><span class="yr">${MON[n.m]} ${n.y}</span><div class="t"><b>${esc(n.title)}</b></div><span class="go">Details</span></a>`).join('')}</div></div></div></section>
    <section style="padding-top:0"><div class="wrap"><div class="head"><div><div class="eyebrow">Recent</div><h2 class="sec">New publications</h2></div><a class="btn btn-line" href="#/research/publications">All publications ${ARR}</a></div>
      ${PUBS.slice(0, 4).map((r, i) => pubRow(r, i, 'Paper')).join('')}</div></section>
    <section class="dark"><div class="wrap"><div class="head"><div><div class="eyebrow">People</div><h2 class="sec">Meet the team</h2></div><a class="btn btn-ghost" href="#/people/current">Full team ${ARR}</a></div>
      <div class="grid g4 people">${pis.map(personCard).join('')}</div></div></section>
    <section><div class="wrap"><div class="call"><canvas class="bg"></canvas><div><div class="eyebrow">Join us</div><h2>${phd ? esc(phd.title) : 'Open positions'}</h2><p>${phd ? esc(phd.text[0]) : 'Check our current opportunities.'}</p></div>
      <div><a class="btn" href="#/join">See opportunities ${ARR}</a></div></div></div></section>`;
  },
  research(p) {
    const k = p[1] || 'lines', h = (t, s) => pageHead(p, t, s, [['Research', '#/research/lines'], [t]]);
    if (k === 'publications') return wrapPage(h('Publications', 'Peer-reviewed articles by the group, by year.'), listPage(PUBS, 'publications', { linkLabel: 'Paper' }));
    if (k === 'patents') return wrapPage(h('Patents', 'Registered inventions and technology transfer.'), listPage(PATENTS, 'patents', { linkLabel: 'Link' }));
    if (k === 'theses') return wrapPage(h('PhD theses', 'Doctoral theses defended in the group.'), listPage(THESES, 'theses', { linkLabel: 'Thesis' }));
    if (k === 'datasets') return wrapPage(h('Datasets & software', 'Open resources released by the group.'), prosePage(PAGES_HTML.datasets));
    if (k === 'collaborations') return wrapPage(h('Recent collaborations', 'Groups and institutions we work with.'), prosePage(PAGES_HTML.collaborations));
    return `${h('Research lines', 'Two complementary lines of investigation: classical and quantum.')}<section><div class="wrap"><div class="grid g2">
      ${LINES.map((l, i) => `<div class="line rv" style="--i:${i};background:var(--navy-900);color:#fff"><span class="mono">0${i + 1}</span><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p><ul>${l.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p style="margin-top:34px"><a class="btn" href="#/research/publications">See publications ${ARR}</a></p></div></section>`;
  },
  people(p) {
    const k = p[1] || 'current', h = (t, s) => pageHead(p, t, s, [['People', '#/people/current'], [t]]);
    const grp = names => names.map(g => { const l = PEOPLE.filter(x => x.group === g); return l.length ? `<div class="grp">${g}</div><div class="grid g4 people">${l.map(personCard).join('')}</div>` : ''; }).join('');
    if (k === 'investigators') return wrapPage(h('Principal investigators', 'Academic staff leading the group.'), grp(['Staff']));
    if (k === 'students') return wrapPage(h('PhD students & postdocs', 'Early-career researchers.'), grp(['Postdoctoral researchers', 'PhD students']));
    if (k === 'honorary') return wrapPage(h('Honorary professors', 'Emeritus and honorary members.'), grp(['Emeritus & honorary professors']));
    if (k === 'alumni') return wrapPage(h('Former members', 'Colleagues who have been part of the group.'), `<div class="prose formerlist">${FORMER}</div>`);
    return wrapPage(h('Current team', `${PEOPLE.length} people working on light-matter and quantum systems.`), grp(['Staff', 'Emeritus & honorary professors', 'Postdoctoral researchers', 'PhD students', 'Associated professors']));
  },
  teaching(p) {
    const k = p[1] || 'courses', h = (t, s) => pageHead(p, t, s, [['Teaching', '#/teaching/courses'], [t]]);
    if (k === 'master-thesis') return wrapPage(h('Master theses', 'Master projects supervised by the group.'), listPage(MASTER, 'master theses', { linkLabel: 'Open' }));
    if (k === 'seminars') return wrapPage(h('Seminars & summer schools', 'Scientific events organised by the group.'), flagged('The current website has no dedicated seminars page. Workshops and events appear in <a href="#/news">News</a>; please provide the seminar listing.') + `<div class="grid g3">${NEWS.filter(n => n.cat === 'Event').map(newsCard).join('')}</div>`);
    return wrapPage(h('Courses', 'Bachelor and master programmes where the group teaches.'), prosePage(PAGES_HTML.courses));
  },
  outreach(p) {
    const k = p[1] || 'activities', h = (t, s) => pageHead(p, t, s, [['Outreach', '#/outreach/activities'], [t]]);
    if (k === 'talks') return wrapPage(h('Talks', 'Outreach talks and gender-equality actions.'), prosePage(GENDER_TALKS));
    if (k === 'interviews') return wrapPage(h('Interviews & press', 'The group in journals, radio, podcasts and webinars.'), prosePage(INTERVIEWS));
    if (k === 'gallery') { const all = NEWS.flatMap(n => n.img.map(i => [i, n.title])); return wrapPage(h('Photo gallery', 'Moments from the life of the group.'), `<div class="gallery">${all.map(([s, t]) => pxImg(s, t)).join('')}</div>`); }
    return wrapPage(h('Activities & workshops', 'Bringing optics and photonics to society.'), prosePage(PAGES_HTML.outreach) + `<div class="grp" style="margin-top:50px">Recent outreach news</div><div class="grid g3">${NEWS.filter(n => n.cat === 'Outreach' || n.cat === 'Event').slice(0, 6).map(newsCard).join('')}</div>`);
  },
  news(p) {
    const id = p[1];
    if (id) {
      const n = NEWS.find(x => newsId(x) === id);
      if (n) return `${pageHead(p, n.title, `${MON[n.m]} ${n.y} · ${n.cat}`, [['News', '#/news'], [n.cat]])}<section><div class="wrap">
        <div class="prose art">${n.text.map((t, k) => `<p${k ? '' : ' class="lead"'}>${esc(t)}</p>`).join('')}${n.link ? `<p><a class="btn" href="${esc(n.link)}" target="_blank" rel="noopener">More information ↗</a></p>` : ''}</div>
        ${n.img.length ? `<div class="figs" data-n="${n.img.length}">${n.img.map(i => `<figure><img src="${i}" alt="${esc(n.title)}"></figure>`).join('')}</div>` : ''}
        <p class="prose"><a href="#/news">← All news</a></p></div></section>`;
    }
    const cats = [...new Set(NEWS.map(n => n.cat))], ys = years(NEWS);
    return `${pageHead(p, 'News', 'Events, publications, awards and life in the group.', [['News']])}<section><div class="wrap">
      ${newsBanner(bannerItems())}<div class="grp" style="margin-top:50px">All news</div>
      <div class="tools" data-news><button class="fchip on" data-c="all">All</button>${cats.map(c => `<button class="fchip" data-c="${c}">${c}</button>`).join('')}<span style="flex:1"></span>
      <select class="search" style="min-width:120px" aria-label="Year"><option value="all">All years</option>${ys.map(y => `<option>${y}</option>`).join('')}</select></div>
      <div class="grid g3" id="newsgrid">${NEWS.map((n, i) => newsCard(n, i % 3).replace('class="card', `data-c="${n.cat}" data-y="${n.y}" class="card`)).join('')}</div><div class="empty" id="none" hidden>No news match.</div></div></section>`;
  },
  join(p) {
    const phd = NEWS.find(n => /Open PhD/i.test(n.title));
    return `${pageHead(p, 'Join us', 'Research positions, theses and visits in optics and photonics.', [['Join us']])}<section><div class="wrap">
      <div class="head"><div><div class="eyebrow">Open positions</div><h2 class="sec">PhD & postdoc opportunities</h2></div></div>
      ${phd ? `<div class="call"><canvas class="bg"></canvas><div><div class="eyebrow">PhD · ${MON[phd.m]} ${phd.y}</div><h2>${esc(phd.title)}</h2>${phd.text.map(t => `<p>${esc(t)}</p>`).join('')}</div><div>${phd.link ? `<a class="btn" href="${esc(phd.link)}" target="_blank" rel="noopener">PHYNEST call ↗</a>` : ''}</div></div>` : ''}
      ${flagged('Postdoc positions are not listed on the current website; this block is ready for them.')}
      <div class="grp" style="margin-top:60px">How to apply</div>
      <div class="steps">${[['Explore', 'Read our research lines and publications.'], ['Contact', 'Write to a supervisor with your CV and interests.'], ['Apply', 'Submit the official call documentation.'], ['Join', 'Start your project in the group.']].map(([t, d], i) => `<div class="step rv" style="--i:${i}"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      <div class="grp" style="margin-top:60px">FAQ</div><div style="max-width:800px">${[['Which programmes can I apply through?', 'The group offers projects within the PHYNEST (Horizon Europe MSCA COFUND) doctoral programme, coordinated by UAB.'], ['Who do I contact?', 'Principal investigators are listed in People; write to them directly about available projects.'], ['Can I do a Master or Bachelor thesis?', 'Yes. See the Teaching section for past master theses and programmes.']].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
      <p style="margin-top:40px"><a class="btn" href="#/contact">Contact supervisors ${ARR}</a></p></div></section>`;
  },
  about(p) {
    const k = p[1] || 'mission', h = (t, s) => pageHead(p, t, s, [['About', '#/about/mission'], [t]]);
    if (k === 'funding') return wrapPage(h('Funding & grants', ''), flagged('No funding information on the current website. Please provide projects, grants and logos.'));
    if (k === 'climate') return wrapPage(h('Climate commitment', ''), flagged('The climate-actions page of the current website is empty. Please provide the content.'));
    if (k === 'gender') return wrapPage(h('Gender & equality', 'Actions promoting equality in physics.'), prosePage(PAGES_HTML.gender));
    if (k === 'reach') return wrapPage(h('How to reach us', ''), prosePage(PAGES_HTML.reach));
    return wrapPage(h('Mission & history', 'Light, from fundamentals to applications.'), `<div class="prose"><p>The Optics Group is a team of researchers at the Physics Department of the Universitat Autònoma de Barcelona who specialise in the study of light and its applications, spanning classical and quantum optics.</p></div>
      <div class="stats" style="margin-top:40px;border-color:var(--line)">${[[PEOPLE.length, 'Members'], [PUBS.length, 'Publications listed'], [THESES.length, 'PhD theses'], [PATENTS.length, 'Patents']].map(([n, l]) => `<div class="stat" style="border-color:var(--line)"><b data-count="${n}">0</b><span style="color:var(--muted)">${l}</span></div>`).join('')}</div>${flagged('A fuller history of the group can be added here.')}`);
  },
  contact(p) {
    return `${pageHead(p, 'Contact', 'Write to us or find us on campus.', [['Contact']])}<section><div class="wrap two">
      <form class="f" id="cform"><label>Name<input required name="name" autocomplete="name" maxlength="120"></label><label>Your email<input required type="email" name="email" autocomplete="email" maxlength="200"></label>
        <label>Topic<select name="topic"><option>General</option><option>PhD / postdoc</option><option>Collaboration</option><option>Press</option></select></label><label>Message<textarea name="message" rows="5" required maxlength="5000"></textarea></label>
        <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none">
        <button class="btn" style="justify-self:start">Send message ${ARR}</button><p class="fstatus" role="status" aria-live="polite"></p></form>
      <div class="prose"><h2 style="margin-top:0">Find us</h2><p>Physics Department, Facultat de Ciències, Edifici C (area C3 Parell)<br>Universitat Autònoma de Barcelona<br>E-08193 Bellaterra (Cerdanyola del Vallès)</p><p><a href="#/about/reach">How to reach us →</a></p></div></div></section>`;
  },
};

/* ---------- router ---------- */
const main = $('#main'), header = $('#header');
/* Maintenance switch (panel → "Modo mantenimiento"). Add ?preview to the URL to see the site anyway. */
const PREVIEW = new URLSearchParams(location.search).has('preview');
function renderMaintenance() {
  document.body.classList.add('maint');
  document.title = `${MAINT.title || 'Under maintenance'} · Optics Group · UAB`;
  main.innerHTML = `<section class="maint-screen"><canvas class="bg"></canvas>
    <div class="maint-box"><canvas class="gears" role="img" aria-label="Animated gears and wrench"></canvas>
    <div class="eyebrow">Optics Group · Universitat Autònoma de Barcelona</div>
    <h1>${esc(MAINT.title || 'Under maintenance')}</h1>
    ${paras(MAINT.message || 'We are improving the website. Please come back soon.').map(t => `<p class="lead">${esc(t)}</p>`).join('')}</div></section>`;
  $$('canvas.bg', main).forEach(c => startBackground(c, { size: 34 }));
  $$('canvas.gears', main).forEach(startGears);
}
function render() {
  if (MAINT.enabled && !PREVIEW) return renderMaintenance();
  const path = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const key = path[0] || 'home';
  main.innerHTML = `<div class="pg">${(ROUTES[key] || ROUTES.home)(path)}</div>`;
  $$('.nav a.top').forEach(a => a.classList.toggle('on', a.dataset.k === key));
  document.title = (path.length ? path.map(s => s.replace(/-/g, ' ')).join(' · ') + ' · ' : '') + 'Optics Group · UAB';
  scrollTo({ top: 0, behavior: 'instant' });
  closeMenu(); mount(main);
}
function mount(root) {
  $$('canvas.bg', root).forEach(c => startBackground(c, { size: c.closest('.call') ? 26 : 34 }));
  $$('canvas.dissolve', root).forEach(dissolve);
  initPixelImages(root);
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
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
  const lst = $('[data-list]', root);
  if (lst) {
    let y = 'all', q = '';
    const apply = () => { let n = 0; $$('#rows .row').forEach(r => { const ok = (y === 'all' || r.firstElementChild.textContent === y) && (!q || r.textContent.toLowerCase().includes(q)); r.hidden = !ok; n += ok; }); $('#none').hidden = n > 0; };
    lst.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('.fchip', lst).forEach(x => x.classList.toggle('on', x === b)); y = b.dataset.y; apply(); });
    $('.search', lst)?.addEventListener('input', e => { q = e.target.value.toLowerCase(); apply(); });
  }
  const nl = $('[data-news]', root);
  if (nl) {
    let c = 'all', y = 'all';
    const apply = () => { let n = 0; $$('#newsgrid .card').forEach(el => { const ok = (c === 'all' || el.dataset.c === c) && (y === 'all' || el.dataset.y === y); el.hidden = !ok; n += ok; }); $('#none').hidden = n > 0; };
    nl.addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; $$('.fchip', nl).forEach(x => x.classList.toggle('on', x === b)); c = b.dataset.c; apply(); });
    $('select', nl).addEventListener('change', e => { y = e.target.value; apply(); });
  }
  $('#cform', root)?.addEventListener('submit', sendContact);
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
  const f = e.target, btn = $('button', f), st = $('.fstatus', f), d = Object.fromEntries(new FormData(f));
  if (d.botcheck) return;
  const say = (msg, ok) => { st.textContent = msg; st.dataset.ok = ok ? '1' : '0'; };
  if (!CONTACT_FORM_KEY) { say('The contact form is not available yet. Please try again later.', false); return; }
  btn.disabled = true; say('Sending…', true);
  try {
    const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: CONTACT_FORM_KEY, subject: `[opticsuab.eu] ${d.topic}: message from ${d.name}`, from_name: 'Optics Group website', name: d.name, email: d.email, replyto: d.email, topic: d.topic, message: d.message }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.message || r.status);
    f.reset(); say('Thank you! Your message has been sent. We will reply to your email.', true);
  } catch (err) { console.error(err); say('Sorry, the message could not be sent. Please try again in a few minutes.', false); }
  finally { btn.disabled = false; }
}
function toast(msg) { let t = $('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' })); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }

/* ---------- shell ---------- */
$('#nav').innerHTML = NAV.map(n => `<div><a class="top" data-k="${n.k}" href="#/${n.k}${n.sub[0] ? '/' + n.sub[0][0] : ''}">${n.l}</a>${n.sub.length ? `<div class="drop">${n.sub.map(([k, l]) => `<a href="#/${n.k}/${k}">${l}</a>`).join('')}</div>` : ''}</div>`).join('');
$('#footlinks').innerHTML = NAV.map(n => `<a href="#/${n.k}${n.sub[0] ? '/' + n.sub[0][0] : ''}">${n.l}</a>`).join('');
$('#year').textContent = new Date().getFullYear();
const closeMenu = () => { $('#nav').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); header.classList.remove('menu'); };
$('#burger').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); header.classList.toggle('menu', o); });
$('#nav').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
addEventListener('scroll', () => {
  header.classList.toggle('solid', scrollY > 40);
  $('#progress').style.transform = `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
}, { passive: true });
addEventListener('hashchange', render);
loadData().then(render).catch(err => {
  console.error(err);
  main.innerHTML = '<section><div class="wrap"><h1>Content could not be loaded</h1><p>Please reload the page in a few seconds.</p></div></section>';
});
