import { nodo, boton } from '../componentes/dom.js';
export function leerRuta(search, catalogo) {
  const p = new URLSearchParams(search);
  const relato = catalogo.relatos.find(r => r.id === p.get('relato')) || catalogo.relatos[0];
  return { relatoId: relato.id, modo: p.get('modo') === 'visual' ? 'visual' : 'texto' };
}
export function escribirRuta(estado, { reemplazar = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('relato', estado.relatoId);
  url.searchParams.set('modo', estado.modo);
  if (url.href !== location.href) history[reemplazar ? 'replaceState' : 'pushState'](null, '', url);
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
