# opticsuab.github.io

Web del Grupo de Óptica de la UAB, publicada en **https://opticsuab.eu** con GitHub Pages.

## Cómo editar el contenido (sin tocar código)

1. Entra en **https://app.pagescms.org** e inicia sesión con GitHub.
2. Abre el repositorio **opticsuab/opticsuab.github.io**.
3. En el menú de la izquierda elige qué editar: *Noticias*, *Personas*, *Publicaciones*, etc.
4. Haz los cambios y pulsa **Save**. La web se actualiza sola en 1–2 minutos.

## Estructura

| Carpeta / archivo | Qué contiene |
|---|---|
| `index.html`, `css/`, `js/` | Diseño y funcionamiento de la web (no se editan desde el panel) |
| `data/*.json` | Contenido: noticias, personas, publicaciones, tesis, patentes, páginas |
| `img/` | Imágenes (las fotos subidas desde el panel van a `img/news` y `img/people`) |
| `.pages.yml` | Configuración del panel de edición |
| `CNAME` | Dominio propio (opticsuab.eu) |

Los textos largos de algunas páginas (cursos, colaboraciones, divulgación, entrevistas…) están en `data/pages.json` en formato HTML.
