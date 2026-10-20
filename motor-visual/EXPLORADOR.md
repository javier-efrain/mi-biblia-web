# Explorador educativo compartido · Etapa 3

Implementación aislada en `motor-visual/`, rama `desarrollo-motor-visual`. Exclusivamente recursos sintéticos de demostración; sin contenido definitivo de V15 ni cambios al lector RVC.

## Comportamiento

- Puntos numerados sobre el plano de imagen, con coordenadas normalizadas 0–1. Los botones inferiores muestran los nombres y ambos controles reflejan la misma selección mediante color y `aria-pressed`.
- Mostrar/Ocultar puntos oculta también sus botones y muestra la descripción general (`leyenda`). La imagen, el zoom y el desplazamiento permanecen. Mostrar recupera selección y página.
- Las explicaciones usan el mismo componente de lectura horizontal que contexto, estudio y devocional. Cada marcador recuerda su página por separado; cambiar página conserva la selección. Anterior/Siguiente, flechas del teclado y gesto horizontal disponibles. Los paneles heredados de una página no muestran navegación innecesaria.
- Las explicaciones admiten desplazamiento vertical normal (`touch-action:pan-y`), no cancelan eventos táctiles y solo paginan ante un gesto predominantemente horizontal. Se descartan gestos cancelados y de varios dedos.
- Visor integrado 3:4 con imagen 2:3 completa y centrada a 100 %, sin recorte ni deformación. Zoom 100–400 %, desplazamiento nativo táctil o barras/teclado, arrastre con ratón y Restablecer. Imagen y marcadores comparten plano y desplazamiento. El modal sigue siendo opcional.
- Estudio/Devocional conservan la misma instancia del visor y todo su estado. Cambiar relato o pasar a Solo texto desmonta el visor; no se promete persistir ese estado después del desmontaje.
- Solo texto conserva el aislamiento de carga y DOM de las etapas anteriores. Permanecen tema oscuro, interfaz compacta y preferencias tipográficas 8–30 px.

## Contrato compatible

Un marcador admite `paginas: [{id, titulo, parrafos}]`, con identificadores únicos y contenido no vacío. Los `parrafos` heredados siguen funcionando como una página. Si están presentes ambas propiedades, `paginas` tiene precedencia. Cada explicación muestra además `certezaHistorica`.

La nueva imagen `datos/recursos/diagrama-vertical-demo.svg` es geometría sintética 800×1200; los centros A/B están en (0,25; 0,5) y (0,75; 0,5). Los tres relatos comparten el mismo recurso y los mismos componentes. El SVG horizontal anterior se conserva intacto.

## Verificación reproducible

```sh
python motor-visual/pruebas/verificar_chromium.py
```

Requiere Chromium, Python, Playwright y jsonschema ya disponibles en el entorno. La prueba inicia un servidor local efímero en 127.0.0.1, lo cierra al finalizar y no publica contenido. Resultados detallados en `pruebas/resultados.json` y capturas `pruebas/capturas/explorador-*.png`.

La suite comprueba contratos, compatibilidad de paneles anteriores, composición editorial, navegación, preferencias, carga aislada de Solo texto, selección, ocultación, páginas independientes, conservación entre enfoques, zoom y alineación. Las comprobaciones de navegador cubren escritorio 1280×900 y móvil simulado 390×844, con tamaños de 8, 20 y 30 px. Los gestos móviles de explicación y de imagen ampliada se ejecutan mediante eventos táctiles del protocolo de Chromium; también se comprueba el arrastre real con ratón.

Resultado en Chromium 154.0.8037.57: **60/60 pruebas de componentes en escritorio y 60/60 en móvil**, 8 documentos válidos contra los esquemas, más 22 comprobaciones del explorador en escritorio y 24 en móvil. También pasaron las pruebas existentes de demo (21/22), accesibilidad (27/29), compactación (45/51) y composición (26/28). Sin errores JavaScript no controlados. Las capturas se revisaron visualmente.

Los 394 archivos originales se compararon byte por byte con `origin/main`: ninguno alterado. Todos los cambios de esta etapa están dentro de `motor-visual/`. No se ha probado aún en un teléfono físico, Safari o Firefox. El zoom usa los controles existentes, sin agregar un gesto personalizado de pellizco.

## Actualizar la vista previa privada en Codespaces

Desde la raíz del repositorio:

```sh
git switch desarrollo-motor-visual
git pull --ff-only origin desarrollo-motor-visual
```

Si el servidor del puerto 8000 sigue funcionando, no hace falta reiniciarlo. Si está detenido:

```sh
python -m http.server 8000 --bind 0.0.0.0
```

En **Puertos / Ports**, buscá **8000**, mantené su visibilidad **Privada / Private** y pulsá **Abrir en el navegador / Open in Browser** (icono de globo). Agregá a la URL:

```text
/motor-visual/demo.html?relato=demo-dos&modo=visual&enfoque=estudio
```

Recargá con Ctrl+Shift+R o Cmd+Shift+R. Probá Punto A/B, Siguiente/Anterior, Ocultar/Mostrar puntos, zoom y Restablecer; alterná Estudio/Devocional para comprobar que el visor mantiene el estado. Solo texto desmonta todos los recursos educativos.
