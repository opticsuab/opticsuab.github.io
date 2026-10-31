# Cómo trabajamos en esta web

Hay dos tipos de cambios y van por caminos distintos:

| Tipo de cambio | Quién | Cómo |
|---|---|---|
| **Contenido**: noticias, personas, publicaciones, tesis, patentes, textos de la portada | Persona editora | Panel **Pages CMS** (app.pagescms.org). Guarda directamente en `main`. |
| **Diseño y código**: `index.html`, `css/`, `js/`, iconos, estructura | Diseñadora / administración | **Rama + pull request**. Nunca directamente en `main`. |

## Reglas para no pisarnos

1. **Antes de empezar, actualiza `main`** (GitHub Desktop: *Fetch origin* → *Pull origin*; terminal: `git pull`).
2. **Crea una rama por tarea** con un nombre que la describa: `diseno/hero`, `fix/menu-movil`, `feat/favicons`.
3. **PR pequeños y frecuentes.** Mejor varios PR de un día que uno de dos semanas.
4. **No edites `data/*.json` a mano en una rama de diseño**: lo edita el panel en `main` y provocaría conflictos. Si un cambio de diseño necesita un campo nuevo, avisa en el PR y cambia también `.pages.yml`.
5. **Fusiona con *Squash and merge*** y borra la rama después.
6. Si al abrir el PR GitHub avisa de conflictos, actualiza tu rama con `main` (*Branch → Update from main* en GitHub Desktop) y resuélvelos antes de fusionar.

## Probar en local

La web carga los datos con `fetch`, así que **no funciona abriendo `index.html` con doble clic**. Hay que servir la carpeta:

```bash
python3 -m http.server 8000      # y abre http://localhost:8000
```

En VS Code también vale la extensión *Live Server*.

## Estructura

```
index.html            esqueleto, fuentes, iconos
css/styles.css        todos los estilos (variables de color en :root)
js/bg.js              fondos de píxeles, transiciones "dissolve", imágenes pixeladas
js/app.js             router por hash (#/ruta), plantillas de cada página, carga de data/*.json
data/*.json           contenido (lo edita el panel)
.pages.yml            campos del panel Pages CMS
img/                  imágenes (news y people se suben desde el panel)
```

Tras cambiar CSS o JS, sube el número `?v=` en `index.html` para que los navegadores no usen la versión en caché.
