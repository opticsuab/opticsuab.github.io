/* Site map shared by the browser (js/app.js) and the publish process (tools/build-pages.mjs).
   Every page of the site has a path here; the menu, the page titles, the breadcrumbs, the static pages that
   search engines read and the sitemap all come from this file, so a page added here appears everywhere. */
const SITE_URL = 'https://opticsuab.eu';
/* Language prefixes: English at the root, the other languages under /es/ and /ca/. */
const LANG_PREFIX = { en: '', es: '/es', ca: '/ca' };
/* Pages without content yet: out of the menu, the sitemap and the static build; their address shows the
   section's first page. Visible with ?preview. To publish one, give it content and remove it from here. */
const DRAFT_PAGES = ['teaching/seminars', 'about/funding', 'about/climate'];
/* Menu: section key, label and sub-pages [key, label]. A section without sub-pages is a page itself. */
const NAV_TREE = [
  { k: 'research', l: 'Research', sub: [['lines', 'Research lines'], ['publications', 'Publications'], ['patents', 'Patents'], ['theses', 'PhD theses'], ['datasets', 'Datasets & software'], ['collaborations', 'Collaborations']] },
  { k: 'people', l: 'People', sub: [['current', 'Current team'], ['investigators', 'Principal investigators'], ['students', 'PhD students & postdocs'], ['alumni', 'Former members'], ['honorary', 'Honorary professors']] },
  { k: 'teaching', l: 'Teaching', sub: [['courses', 'Courses'], ['master-thesis', 'Master theses'], ['seminars', 'Seminars & summer schools']] },
  { k: 'outreach', l: 'Outreach', sub: [['activities', 'Activities & workshops'], ['talks', 'Talks'], ['interviews', 'Interviews & press'], ['gallery', 'Photo gallery']] },
  { k: 'news', l: 'News', sub: [] },
  { k: 'join', l: 'Join us', sub: [] },
  { k: 'about', l: 'About', sub: [['mission', 'Mission & history'], ['funding', 'Funding & grants'], ['climate', 'Climate commitment'], ['gender', 'Gender & equality'], ['reach', 'How to reach us']] },
];
/* Title and description (English; translated with js/i18n.js) of every fixed page, by path. */
const PAGE_META = {
  'research/lines': ['Research lines', 'Two complementary lines of investigation: classical and quantum.'],
  'research/publications': ['Publications', 'Peer-reviewed articles by the group, by year.'],
  'research/patents': ['Patents', 'Registered inventions and technology transfer.'],
  'research/theses': ['PhD theses', 'Doctoral theses defended in the group.'],
  'research/datasets': ['Datasets & software', 'Open resources released by the group.'],
  'research/collaborations': ['Recent collaborations', 'Groups and institutions we work with.'],
  'people/current': ['Current team', '{n} people working on light-matter and quantum systems.'],
  'people/investigators': ['Principal investigators', 'Academic staff leading the group.'],
  'people/students': ['PhD students & postdocs', 'Early-career researchers.'],
  'people/alumni': ['Former members', 'Colleagues who have been part of the group.'],
  'people/honorary': ['Honorary professors', 'Emeritus and honorary members.'],
  'teaching/courses': ['Courses', 'Bachelor and master programmes where the group teaches.'],
  'teaching/master-thesis': ['Master theses', 'Master projects supervised by the group.'],
  'teaching/seminars': ['Seminars & summer schools', 'Scientific events organised by the group.'],
  'outreach/activities': ['Activities & workshops', 'Bringing optics and photonics to society.'],
  'outreach/talks': ['Talks', 'Outreach talks and gender-equality actions.'],
  'outreach/interviews': ['Interviews & press', 'The group in journals, radio, podcasts and webinars.'],
  'outreach/gallery': ['Photo gallery', 'Moments from the life of the group.'],
  'news': ['News', 'Events, publications, awards and life in the group.'],
  'join': ['Join us', 'Research positions, theses and visits in optics and photonics.'],
  'about/mission': ['Mission & history', 'Light, from fundamentals to applications.'],
  'about/funding': ['Funding & grants', ''],
  'about/climate': ['Climate commitment', ''],
  'about/gender': ['Gender & equality', 'Actions promoting equality in physics.'],
  'about/reach': ['How to reach us', 'Faculty of Sciences, Edifici C, on the UAB campus in Bellaterra.'],
  'contact': ['Contact', 'Write to us or find us on campus.'],
};
/* A section's own address (/research) shows its first page. */
const SECTION_HOME = Object.fromEntries(NAV_TREE.filter(n => n.sub.length).map(n => [n.k, `${n.k}/${n.sub[0][0]}`]));
const isDraftPath = (path, preview) => !preview && DRAFT_PAGES.includes(path);
const navFor = preview => NAV_TREE.map(n => ({ ...n, sub: n.sub.filter(([k]) => !isDraftPath(`${n.k}/${k}`, preview)) }));
/* Fixed pages that are published (no drafts), plus the home page (''). */
const PUBLIC_PAGES = ['', ...Object.keys(PAGE_META).filter(p => !DRAFT_PAGES.includes(p))];
/* Address of a news item: year-month-title, from the title as written in the panel. */
const newsSlug = (y, m, title) => `${y}-${m}-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
