import { nodo, boton } from '../componentes/dom.js';
export function leerRuta(search, catalogo) {
  const p = new URLSearchParams(search);
  const relato = catalogo.relatos.find(r => r.id === p.get('relato')) || catalogo.relatos[0];
  return { relatoId: relato.id, modo: p.get('modo') === 'visual' ? 'visual' : 'texto', enfoque:p.get('enfoque') === 'devocional' ? 'devocional' : 'estudio' };
}
export function escribirRuta(estado, { reemplazar = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('relato', estado.relatoId);
  url.searchParams.set('modo', estado.modo);
  url.searchParams.set('enfoque', estado.enfoque || 'estudio');
  if (url.href !== location.href) history[reemplazar ? 'replaceState' : 'pushState'](null, '', url);
}
export function crearIndiceCapitulo(catalogo, id, seleccionar) {
  const actual = catalogo.relatos.find(r => r.id === id);
  const ref = actual.referencia, capitulo = ref.rangos[0].capitulo;
  const relatos = catalogo.relatos.filter(r => r.coleccionId === actual.coleccionId &&
    r.referencia.version === ref.version && r.referencia.libro === ref.libro &&
    r.referencia.rangos.some(x => x.capitulo === capitulo)).sort((a,b) => a.orden-b.orden);
  const bloque = nodo('section', { className:'mv-capitulo', 'aria-label':'Libro, capítulo y relatos' },
    nodo('p', { className:'mv-libro' },ref.libro.replaceAll('-',' ')),
    nodo('h1', {},`Capítulo ${capitulo}`),
    nodo('nav', { className:'mv-indice', 'aria-label':'Índice de relatos del capítulo' },
      ...relatos.map(r => boton(r.titulo, () => seleccionar(r.id), {
        'data-relato-indice':r.id, 'aria-current':r.id === id ? 'true' : 'false', title:r.referenciaEtiqueta
      }))));
  requestAnimationFrame(() => {
    if (!bloque.isConnected) return;
    const indice = bloque.querySelector('.mv-indice'), activo = indice.querySelector('[aria-current="true"]');
    const a = activo.getBoundingClientRect(), n = indice.getBoundingClientRect();
    // Desplazar únicamente el índice; no mover la posición vertical del lector.
    indice.scrollLeft += a.left - n.left - (indice.clientWidth-a.width)/2;
  });
  return bloque;
}
export function vecinos(catalogo, id) {
  const actual = catalogo.relatos.find(r => r.id === id);
  if (!actual) throw new Error('Relato inexistente.');
  const relatos = catalogo.relatos.filter(r => r.coleccionId === actual.coleccionId).sort((a,b) => a.orden - b.orden);
  const i = relatos.findIndex(r => r.id === id);
  const capitulo = actual.referencia.rangos[0].capitulo;
  const mismoLibro = r => r.referencia.libro === actual.referencia.libro && r.referencia.version === actual.referencia.version;
  const capitulos = [...new Set(relatos.filter(mismoLibro).flatMap(r => r.referencia.rangos.map(x => x.capitulo)))].sort((a,b) => a-b);
  const c = capitulos.indexOf(capitulo);
  const primeroEn = n => relatos.find(r => mismoLibro(r) && r.referencia.rangos.some(x => x.capitulo === n));
  return { anterior: relatos[i-1], siguiente: relatos[i+1], capituloAnterior: primeroEn(capitulos[c-1]), capituloSiguiente: primeroEn(capitulos[c+1]) };
}
export function crearNavegacion(catalogo, id, seleccionar) {
  const v = vecinos(catalogo, id);
  return nodo('nav', { className:'mv-navegacion', 'aria-label':'Navegación bíblica' },
    ...[['Relato anterior',v.anterior],['Relato siguiente',v.siguiente],['Capítulo anterior',v.capituloAnterior],['Capítulo siguiente',v.capituloSiguiente]].map(([label,r]) =>
      boton(label, () => seleccionar(r.id), { disabled:!r, 'aria-label':r ? `${label}: ${r.titulo}` : label })));
}
