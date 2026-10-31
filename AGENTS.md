# Copilot instructions — opticsuab.eu

Static website for the Optics Group (Universitat Autònoma de Barcelona), served by GitHub Pages from `main`. No build step, no framework, no npm.

- `index.html` is the shell. All pages are rendered client-side by `js/app.js` (hash router: `#/section/subsection`, see `NAV` and `ROUTES`).
- Content lives in `data/*.json` and is edited by a non-technical editor through Pages CMS (`.pages.yml`). Do not hard-code content that exists in `data/`; read it through the globals filled in `loadData()` (`NEWS`, `PEOPLE`, `PUBS`, `THESES`, `PATENTS`, `MASTER`, `SITE`, `PAGES_HTML`, …).
- If you add or rename a JSON field, update `loadData()` and the matching field in `.pages.yml` in the same change, and keep old data working.
- Styling: plain CSS in `css/styles.css`; use the CSS variables in `:root` (navy/teal/green palette, IBM Plex Sans/Mono). Pixel-grid visuals come from `js/bg.js`.
- Escape all user content with `esc()` before inserting into HTML templates.
- Respect `prefers-reduced-motion` (`REDUCED` in `bg.js`).
- After changing CSS/JS, bump the `?v=` query in `index.html`.
- Test locally with `python3 -m http.server` (fetch does not work from `file://`).
- Work on a branch and open a pull request; never push design changes directly to `main`.
