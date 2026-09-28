# AppGYM — guía del proyecto

App de gimnasio personal (PWA) para armar rutinas y registrar entrenamientos desde el celular, sin internet.
Spec original: [SPECAppGYM.md](SPECAppGYM.md). Cómo probar y publicar: [README.md](README.md).

## Sobre el usuario

- Está aprendiendo a crear apps: explicar pasos de terminal/git/GitHub en castellano rioplatense, simple y paso a paso.
  Prefiere que Claude ejecute los comandos de git.
- Estilo **minimalista**: fondo negro, acentos gris claro/blanco, título con la fuente Ranade. Nada de pantallas recargadas.
- Criterio de la spec para sumar funciones: *"¿puedo entrenar y anotar sin esto?"*.

## Stack

HTML + CSS + JavaScript puro con módulos ES. Sin frameworks, sin build, sin dependencias.
Datos en `localStorage` (clave `appgym.v1`), por dispositivo. No hay servidor.

## Archivos

- `index.html` — punto de entrada; `<dialog id="sheet">` se usa para menús y confirmaciones.
- `css/styles.css` — todo el estilo. Colores como variables en `:root` (tema oscuro fijo). `--go` = verde de fin de descanso.
- `js/app.js` — pantallas y router por hash: `#/`, `#/rutina/nueva`, `#/rutina/:id/editar`, `#/entrenar`,
  `#/resumen/:id`, `#/progreso`, `#/ejercicio/:id`, `#/generar`. Cada `render*()` reemplaza `root.innerHTML`
  y asigna `root.onclick/oninput/onsubmit` (delegación con `data-action`).
- `js/store.js` — única capa que toca `localStorage`. `normalize()` migra datos viejos (ajustes, grupos propios,
  ejercicios recomendados nuevos). El entrenamiento en curso vive en `state.active` y se guarda en cada cambio.
- `js/data.js` — grupos, **zonas por músculo** (`MUSCLES`, con `max` para zonas chicas), ejercicios recomendados
  (con `muscle` y `compound`), y clasificación de ejercicios propios por palabras clave (`muscleOf`, `isCompound`).
- `js/generator.js` — "Rutina para hoy": reglas locales, **sin IA ni azar** (el azar solo con `variety` en
  "Otra opción"). Elige bloque Push/Pull/Piernas por lo menos entrenado, reparte ejercicios por rondas entre
  grupos y zonas, prioriza lo que más hace el usuario y sugiere pesos con Epley.
- `sw.js` — service worker: red primero con `cache: 'no-cache'`, y caché de respaldo para offline.
- `tools/serve.py` — servidor local sin caché. `tools/make-icons.mjs` — genera los PNG del ícono.

## Modelo de datos (resumen)

- Ítem de rutina: `{ exerciseId, sets, reps, repsPerSet? }`. `repsPerSet` (ej. `[12,10,8]`) manda sobre sets/reps.
- Entrenamiento guardado: `{ id, routineId, routineName, startedAt, finishedAt, sets: [{ exerciseId, set, reps, weight }] }`.
  Solo se guardan las series marcadas como hechas. `weight` puede ser `null` (peso corporal).
- `active.rest = { startedAt, endsAt, notified }` durante un descanso. `active.restSeconds` = descanso propio de una
  rutina generada (el ajuste "Sin descanso" siempre manda).

## Reglas aprendidas (importante)

- **No usar `window.confirm()`**: en el navegador del usuario devuelve `false` sin mostrar nada. Usar `ask()` de app.js.
- En `ask()`, resolver al tocar el botón: el evento `close` del `<dialog>` a veces no llega.
- **Subir `CACHE` en `sw.js` en cada cambio** (`appgym-vN`), y sumar a `FILES` cualquier archivo nuevo.
- Todo texto del usuario pasa por `esc()` antes de ir al HTML.
- Probar en el panel del navegador en tamaño celular (375×812). Antes de probar, guardar `localStorage` en
  `sessionStorage` y restaurarlo al final para no romper los datos del usuario. Si aparecen archivos viejos,
  refrescarlos con `fetch(url, { cache: 'reload' })`.

## Probar y publicar

- Local: `python tools/serve.py` → http://localhost:5173
- Repo: https://github.com/bottcherr/AppGymPersonal (rama `main`)
- App publicada (GitHub Pages): https://bottcherr.github.io/AppGymPersonal/ — instalada en iPhone con "Agregar a inicio".
- **Hacer commit y push solo cuando el usuario diga "subilo"** (o lo pida explícitamente). Después, verificar que
  Pages sirva la versión nueva de `sw.js`.

## Ideas pendientes (de la spec y charlas)

- Calculadora de discos, registro de esfuerzo (RPE), etiquetas por disciplina, sincronización con servidor.
- "Compartir rutina" para pasar una sola rutina a otra persona sin reemplazar todos sus datos.
- Que el generador pese más lo reciente que lo viejo del historial.
