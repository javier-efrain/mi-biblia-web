# Accesibilidad visual del prototipo

## Cambios

- Apariencia oscura por defecto, con fondo gris muy oscuro, texto claro y acentos dorados. Apariencia clara opcional.
- Controles A− / A+ con rango 16–32 px, incremento de 2 px y valor inicial de 20 px.
- Se amplían texto de lectura, estudios, devocionales, explicaciones de mapas y paneles de los visores, incluido el modal.
- Preferencias locales y recuperables tras recargar. Un fallo o bloqueo del almacenamiento no impide leer ni ajustar la presentación.
- Controles de al menos 48 × 48 px, foco visible, etiquetas accesibles y uso mediante Tab, Enter o Espacio.
- Ajuste por CSS sin reconstruir contenido ni alterar la selección, la página de explicación o el zoom.
- Párrafos con altura natural y ajuste de línea. Solo las imágenes ampliadas mantienen desplazamiento intencional dentro del visor.

Todos los cambios se limitan a `motor-visual/`, en `desarrollo-motor-visual`. Se mantienen el modo Solo texto, la carga diferida de recursos, los anclajes, los visores 3:4, las portadas 16:9 y la navegación. El aviso y los datos siguen siendo sintéticos. No se integra Marcos 12, V15 ni texto RVC real.

## Resultados

Chromium 154.0.8037.57, mediante Playwright. Ejecución reproducible:

```sh
python motor-visual/pruebas/verificar_chromium.py
```

| Comprobación | Escritorio 1280 × 900 | Móvil simulado 390 × 844 |
|---|---:|---:|
| Suite JavaScript de regresión y preferencias | 43/43 | 43/43 |
| Interacciones existentes de la demo | 21/21 | 22/22 |
| Comprobaciones específicas de accesibilidad | 27/27 | 29/29 |

También se validaron los ocho documentos de datos con JSON Schema. Los 394 archivos ajenos al motor conservaron sus SHA-256 durante las pruebas.

Las comprobaciones nuevas cubren:

- Inicio oscuro a 20 px sin depender de la apariencia del sistema operativo.
- Apariencia y tamaño recuperados al recargar; contenido del almacenamiento limitado a ambos valores.
- Preferencias corruptas, tamaños inválidos y almacenamiento bloqueado.
- Límites 16 y 32 px, tamaños de controles y foco por teclado.
- Texto a 32 px en lectura, explicación extensa, devocional, panel de mapa y modal.
- Ausencia de recortes y desbordamiento horizontal de párrafos; prueba adicional a 320 px de ancho.
- Conservación del estado al ajustar letra, cambiar modo y navegar.
- Zoom, marcadores y diálogo operativos con letra a 32 px.
- Contraste de texto principal/secundario sobre los cuatro fondos de la paleta y texto sobre botones seleccionados: al menos 4,5:1 en ambas apariencias. Acento de foco sobre el fondo: al menos 3:1.

No hubo errores JavaScript no controlados. Se revisaron las capturas oscuras de escritorio y móvil con texto a 32 px.

Evidencias:

- [Resultados completos](pruebas/resultados.json).
- [Escritorio oscuro, 32 px](pruebas/capturas/escritorio-oscuro-32.png).
- [Móvil oscuro, 32 px](pruebas/capturas/movil-oscuro-32.png).
- [Escritorio claro, 32 px](pruebas/capturas/escritorio-claro-32.png).
- [Móvil claro, 32 px](pruebas/capturas/movil-claro-32.png).

## Actualizar la vista previa en Codespaces

En la terminal del Codespace, desde la raíz del repositorio y sin cambios propios pendientes, ejecutar:

```sh
git switch desarrollo-motor-visual
git pull --ff-only origin desarrollo-motor-visual
```

No hace falta compilar ni instalar dependencias para abrir la demo. Si el servidor Python ya sigue encendido, sirve los archivos actualizados sin reiniciarlo. Usar una terminal nueva para actualizar Git si la anterior está ocupada con el servidor.

Si el servidor está detenido, iniciar desde la raíz del repositorio:

```sh
python -m http.server 8000 --bind 0.0.0.0
```

En **PORTS / Puertos**, mantener el puerto **8000** como **Private / Privado**, pulsar **Open in Browser / Abrir en el navegador** y añadir a la dirección HTTPS:

```text
/motor-visual/demo.html?relato=demo-dos&modo=visual
```

Actualizar esa pestaña con Ctrl+Shift+R (Windows/Linux) o Cmd+Shift+R (macOS). La URL de Codespaces sigue siendo la misma. Las preferencias se conservan para ese origen: si previamente elegiste modo claro, pulsá **Modo oscuro** para volver a activarlo.

Para comprobar la experiencia nueva, aumentar con A+ hasta 32 px, abrir un marcador, cambiar a Devocional de prueba y alternar a Solo texto. El número de página y el tamaño deben conservarse según la acción; Solo texto desmonta los contenidos educativos.

## Límites

Se probó Chromium en escritorio y móvil simulado; no Safari, Firefox, dispositivos físicos ni lectores de pantalla reales. La comprobación de contraste se limita a los pares de colores especificados; no equivale a una certificación WCAG completa. La tipografía contenida dentro del SVG sintético no cambia con A− / A+: se amplía con el zoom del visor. Los paneles que explican esa imagen sí cambian de tamaño.
