import { nodo, boton } from './dom.js';
import { crearVisor } from './visor.js';
import { crearLecturaHorizontal } from './lectura-horizontal.js';
export function crearExplorador(recurso, uso, { signal } = {}) {
  const el = nodo('section', { className:'mv-recurso', 'data-educativo':'recurso', 'data-uso':uso.id });
  const panel = nodo('aside', { className:'mv-panel', 'aria-live':'polite' });
  const nombres = nodo('div', { className:'mv-elementos', role:'group', 'aria-label':'Elementos del recurso' });
  const estados = new Map();
  let activo = null, visibles = true, paginasAbort;
  function descripcionGeneral() {
    paginasAbort?.abort();
    paginasAbort = new AbortController();
    panel.replaceChildren(crearLecturaHorizontal({secciones:[{id:'general',titulo:'Descripción general',paginas:[{
      id:'general',titulo:'Descripción general',parrafos:[recurso.leyenda],referencias:[]
    }]}]}, {signal:paginasAbort.signal,compacto:true,etiqueta:'Descripción general del recurso'}));
  }
  function seleccionar(m) {
    activo = m;
    visor.seleccionarMarcador(m.id);
    [...nombres.children].forEach(b => b.setAttribute('aria-pressed',String(b.dataset.elemento === m.id)));
    paginasAbort?.abort(); paginasAbort = new AbortController();
    if (!estados.has(m.id)) estados.set(m.id, {});
    const paginas = (m.paginas ?? [{id:'unica',titulo:m.titulo,parrafos:m.parrafos}])
      .map(p => ({...p, referencias:[m.certezaHistorica]}));
    panel.replaceChildren(crearLecturaHorizontal({secciones:[{id:m.id,titulo:m.titulo,paginas}]}, {
      signal:paginasAbort.signal, compacto:true, etiqueta:`Explicación de ${m.titulo}`, estado:estados.get(m.id)
    }));
  }
  const visor = crearVisor(recurso, { marcadores:uso.marcadores, seleccionar, signal });
  uso.marcadores.forEach(m => nombres.append(boton(m.titulo, () => seleccionar(m), {
    'data-elemento':m.id, 'aria-pressed':'false'
  })));
  const puntos = boton('Ocultar puntos', () => {
    visibles = !visibles;
    visor.mostrarPuntos(visibles); nombres.hidden = !visibles;
    puntos.textContent = visibles ? 'Ocultar puntos' : 'Mostrar puntos';
    puntos.setAttribute('aria-pressed',String(visibles));
    if (visibles && activo) seleccionar(activo); else descripcionGeneral();
  }, {'aria-pressed':'true', 'data-control':'puntos'});
  if (uso.marcadores.length) visor.el.append(nodo('div', {className:'mv-puntos'}, puntos, nombres));
  const cuerpo = nodo('div', { className:'mv-explorador' }, visor.el, panel);
  signal?.addEventListener('abort', () => { paginasAbort?.abort(); visor.destruir(); }, {once:true});
  descripcionGeneral();
  el.append(nodo('h3', {}, recurso.alt), cuerpo);
  return el;
}
