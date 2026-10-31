# Contribuir a la web

## Dos tipos de cambios

- **Contenido** (noticias, personas, publicaciones, tesis, patentes, textos de la portada, modo mantenimiento): se edita en el panel **Pages CMS**, que guarda directamente en `main`.
- **Diseño y código** (`index.html`, `css/`, `js/`, iconos): siempre en una **rama** y con **pull request** hacia `main`.

## Normas

1. Actualiza `main` antes de empezar (`git pull`).
2. Una rama por tarea, con nombre descriptivo: `diseno/hero`, `fix/menu-movil`.
3. Pull requests pequeños y de corta duración.
4. No edites `data/*.json` a mano en ramas de código: los modifica el panel en `main`. Si hace falta un campo nuevo, añádelo también en `.pages.yml` y en `loadData()` (`js/app.js`), manteniendo compatibles los datos existentes.
5. Fusiona con *Squash and merge* y borra la rama.
6. Si hay conflictos con `main`, actualiza la rama y resuélvelos antes de fusionar.

## Probar en local

La web carga los datos con `fetch`, así que no funciona abriendo `index.html` directamente:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Con el modo mantenimiento activado, añade `?preview` a la URL para ver la web igualmente.

## Estructura

```
index.html        esqueleto, fuentes, iconos
css/styles.css    estilos (variables de color en :root)
js/bg.js          fondos de píxeles, transiciones, imágenes pixeladas, pantalla de mantenimiento
js/app.js         router por hash (#/ruta), plantillas, carga de data/*.json
data/*.json       contenido (lo edita el panel)
.pages.yml        campos del panel
img/              imágenes
```

## Convenciones

- Escapa el contenido con `esc()` antes de insertarlo en HTML.
- Usa las variables CSS de `:root` (paleta navy/teal/green, IBM Plex Sans/Mono).
- Respeta `prefers-reduced-motion` (`REDUCED` en `bg.js`).
- Tras cambiar CSS o JS, sube el número `?v=` en `index.html`.
