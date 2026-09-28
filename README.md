# AppGYM

App de gimnasio personal: armar rutinas y registrar cada entrenamiento desde el celular, sin internet.
La especificación completa está en [SPECAppGYM.md](SPECAppGYM.md).

Es una **PWA** (Progressive Web App): una página web que se instala en el celular como una app y
funciona sin conexión. Está hecha con HTML, CSS y JavaScript puro, sin frameworks ni paso de build.

## Estructura

```
index.html              Punto de entrada (carga estilos y js/app.js)
css/styles.css          Estilos
js/data.js              Grupos musculares y ejercicios recomendados iniciales
js/store.js             Datos: guardar/leer en el dispositivo (localStorage)
js/app.js               Pantallas: inicio, crear/editar rutina, entrenar, resumen
sw.js                   Service worker: guarda la app para abrirla offline
manifest.webmanifest    Nombre, ícono y colores al instalarla
icons/                  Íconos (los PNG se generan con: node tools/make-icons.mjs)
```

## Probarla en la compu

```bash
python tools/serve.py
```

Y abrir http://localhost:5173 (F12 → ícono de celular para verla en tamaño teléfono).

## Instalarla en el celular

Se publica con **GitHub Pages** (*Settings → Pages → Deploy from a branch → main / (root)*) y se abre
`https://<usuario>.github.io/<repo>/` en el celular:

- **Android (Chrome):** menú ⋮ → *Instalar app*.
- **iPhone (Safari):** compartir → *Agregar a inicio*.

Después de la primera carga funciona sin internet. Los datos quedan guardados en ese celular.

## Actualizar la app

Al cambiar archivos, subir la versión en `sw.js` (`const CACHE = 'appgym-vN'`) y, si se agregó un
archivo nuevo, sumarlo a la lista `FILES`. El celular toma los cambios la próxima vez que abre la app con conexión.
