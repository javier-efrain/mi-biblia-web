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
  function resolverRecurso(r) {
    const src = new URL(r.src,base);
    if (src.origin !== base.origin || !src.pathname.startsWith(base.pathname) || !/\.(svg|webp|png|jpe?g)$/i.test(src.pathname)) {
      throw new Error('Ruta de imagen inválida.');
    }
    return {...r,src:src.href};
  }
  async function cargarRecurso(relato, uso, {signal} = {}) {
    if (!relato.recursos.some(u => u.id === uso.id && u.recursoId === uso.recursoId)) throw new Error('Recurso ajeno al pasaje.');
    const biblioteca = validarRecursos(await json('recursos.json',signal));
    const recurso = biblioteca.recursos.find(r => r.id === uso.recursoId && r.demostracion === relato.demostracion);
    if (!recurso) throw new Error('Recurso no disponible.');
    return resolverRecurso(recurso);
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
      const recursos = biblioteca.recursos.map(resolverRecurso);
      datos = { estudio, recursos };
      cache.set(relato.id, datos);
    }
    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    return datos;
  }
  return { cargarCatalogo, cargarVisuales, cargarRecurso };
}
