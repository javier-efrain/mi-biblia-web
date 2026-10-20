# Interfaz compacta · Fase experimental

## Alcance

Cambios exclusivamente en `motor-visual/`, sobre `desarrollo-motor-visual`. No se modifica `main`, el lector RVC ni los prototipos anteriores. Los archivos de datos, estudios sintéticos, recursos y fixtures permanecen idénticos a la fase anterior; no se incorpora Marcos 12 ni se rediseña el contenido educativo.

## Presentación

- Diseño primero para celular, con márgenes laterales de 10 px, separación habitual de 4–8 px, encabezados y tarjetas menores.
- Navegación de relatos y capítulos en una sola barra de cuatro controles. Etiquetas completas y accesibles, con ajuste de línea cuando corresponde.
- Ajustes de lectura reunidos en una barra compacta; el nombre del grupo se conserva para tecnologías de asistencia.
- Tarjetas de descubrimiento en dos columnas en celular y tres en escritorio.
- Apariencia oscura predeterminada, paleta dorada discreta, apariencia clara opcional y foco visible.
- Controles esenciales con área táctil mínima de 44 × 44 px y tipografía independiente del texto de lectura.
- Visor 3:4 de hasta 480 px de ancho. Se conserva su funcionalidad y se aprovecha más ancho en celular. La imagen mantiene su proporción original: las bandas del marco no se eliminan recortando el recurso.

## Lectura y preferencias

Rango experimental **8–30 px**, valor inicial **8 px** y ajustes de 2 px. Se aplica al texto de lectura, estudios, devocionales y explicaciones de mapas/paneles. Las imágenes usan su zoom propio; sus letras incrustadas no cambian con A− / A+.

Se mantiene la clave `mi-biblia-web:motor-visual:preferencias:v1`. Los tamaños válidos anteriores, incluidos los 20 px, se conservan. Los 31/32 px anteriores se ajustan a 30 px. Los datos corruptos usan el nuevo valor experimental de 8 px.

El botón **Restablecer 8 px** vuelve a ese tamaño, lo guarda localmente y conserva la apariencia elegida. No elimina otras preferencias del navegador ni reconstruye los estudios, cambia sus páginas o reinicia el zoom. Si el almacenamiento está bloqueado, funciona durante la sesión.

## Comparación de densidad

Medición del mismo relato en Chromium, con lectura a **20 px en ambas versiones**. Se comparó contra el commit previo `1aa04866d70f26bd11944c638ada43fe7f6474e0`; las respuestas antiguas se sustituyeron únicamente en el navegador de prueba.

| Medida | Anterior | Compacta |
|---|---:|---:|
| Alto de cabecera, celular 390 px | 509,3 px | 181,7 px |
| Alto de cabecera, escritorio | 393,9 px | 155,7 px |
| Ancho del visor, celular | 332 px | 352 px |
| Ancho del visor, escritorio | 480 px | 480 px |

La cabecera se reduce aproximadamente **64 % en celular** y **61 % en escritorio**. El tamaño del visor no depende del tamaño de letra. Estas cifras describen la cabecera y el visor del caso medido; no son porcentajes de reducción de toda la página.

Evidencia: [densidad.json](pruebas/densidad.json). Reproducción opcional: `python motor-visual/pruebas/medir_densidad.py` (requiere el commit histórico disponible).

## Pruebas

Chromium 154.0.8037.57. Escritorio 1280 × 900 y móvil simulado 390 × 844, con comprobaciones adicionales a 320 px de ancho.

| Grupo | Escritorio | Móvil |
|---|---:|---:|
| Suite JavaScript de regresión y preferencias | 45/45 | 45/45 |
| Interacciones existentes de la demo | 21/21 | 22/22 |
| Apariencia, persistencia, teclado y límite máximo | 27/27 | 29/29 |
| Matriz específica de compactación, 8/20/30 px | 45/45 | 51/51 |

La matriz comprueba lectura, explicación extensa, devocional y panel de mapa a los tres tamaños; ambos modos de lectura; apariencia clara; controles táctiles independientes; ausencia de recortes, superposiciones entre controles y desplazamiento horizontal involuntario; visor amplio y proporción constante; recuperación de 20 px antiguos y restablecimiento a 8 px con teclado y tras recargar.

También se conservan las pruebas de navegación, historial, gestos horizontales, zoom, marcadores, modal y foco, respuestas tardías y ausencia de montaje educativo en Solo texto. Se validan ocho documentos con JSON Schema. Los 394 archivos ajenos al motor conservan sus huellas SHA-256.

Ejecutar la verificación completa:

```sh
python motor-visual/pruebas/verificar_chromium.py
```

[Resultados detallados](pruebas/resultados.json). Capturas con las transiciones finalizadas:

- [Celular, 8 px](pruebas/capturas/compacto-movil-8.png).
- [Celular, 20 px](pruebas/capturas/compacto-movil-20.png).
- [Celular, 30 px](pruebas/capturas/compacto-movil-30.png).
- [Escritorio, 8 px](pruebas/capturas/compacto-escritorio-8.png).
- [Escritorio, 20 px](pruebas/capturas/compacto-escritorio-20.png).
- [Escritorio, 30 px](pruebas/capturas/compacto-escritorio-30.png).

No se han probado Safari, Firefox ni teléfonos físicos. Los 8 px son una decisión experimental de esta fase, no un tamaño de lectura recomendado como criterio general de accesibilidad.

## Actualizar Codespaces

En una terminal desde la raíz del repositorio, sin cambios propios pendientes:

```sh
git switch desarrollo-motor-visual
git pull --ff-only origin desarrollo-motor-visual
```

Si el servidor ya está activo, no hace falta reiniciarlo. Si la terminal está ocupada por el servidor, abrir otra para actualizar Git. Si está detenido:

```sh
python -m http.server 8000 --bind 0.0.0.0
```

En **PORTS / Puertos**, mantener **8000** como **Private / Privado**, pulsar **Open in Browser / Abrir en el navegador** y usar:

```text
/motor-visual/demo.html?relato=demo-dos&modo=visual
```

Recargar con Ctrl+Shift+R o Cmd+Shift+R. Si aparece el tamaño anterior de 20 px, pulsar **Restablecer 8 px**; no es necesario borrar el almacenamiento local.

No se realiza merge, publicación en GitHub Pages ni despliegue del prototipo.
