import { validarCatalogo, validarEstudio, validarRecursos, validarRelaciones } from './validacion.js';
export function crearServicioContenidos({ baseURL, fetcher = fetch }) {
  const base = new URL(baseURL);
  const cache = new Map();
  async function json(ruta, signal) {
    const url = new URL(ruta, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Ruta de contenido inválida.');
    const respuesta = await fetcher(url, { signal });
    if (!respuesta.ok) throw new Error(`Contenido no disponible (${respuesta.status}).`);
    return respuesta.json();
  }
  async function cargarCatalogo() { return validarCatalogo(await json('catalogo.json')); }
  async function cargarVisuales(relato, { signal } = {}) {
    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    let datos = cache.get(relato.id);
    if (!datos) {
      const [estudio, biblioteca] = await Promise.all([
        json(`estudios/${relato.estudioId}.json`, signal), json('recursos.json', signal)
      ]);
      validarEstudio(estudio); validarRecursos(biblioteca); validarRelaciones(relato, estudio, biblioteca);
      // Rutas del medio relativas al manifiesto; nunca se aceptan orígenes externos.
      const recursos = biblioteca.recursos.map(r => {
        const src = new URL(r.src, base);
        if (src.origin !== base.origin || !src.pathname.startsWith(base.pathname) || !/\.(svg|webp|png|jpe?g)$/i.test(src.pathname)) {
          throw new Error('Ruta de imagen inválida.');
        }
        return { ...r, src: src.href };
      });
      datos = { estudio, recursos };
      cache.set(relato.id, datos);
    }
    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    return datos;
  }
  return { cargarCatalogo, cargarVisuales };
}
