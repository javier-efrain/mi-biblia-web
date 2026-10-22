import { nodo, boton, abrirDialogoRecurso } from './dom.js';
import { crearVisor } from './visor.js';
import { crearLecturaHorizontal } from './lectura-horizontal.js';
export function crearExplorador(recurso, uso, { signal, pantallaCompleta = true } = {}) {
  const el = nodo('section', { className:'mv-recurso', 'data-educativo':'recurso', 'data-uso':uso.id });
  const panel = nodo('aside', { className:'mv-panel', 'aria-live':'polite' });
  const nombres = nodo('div', { className:'mv-elementos', role:'group', 'aria-label':'Elementos del recurso' });
  const estados = new Map();
  let activo = null, visibles = true, paginasAbort;
  function seleccionar(m) {
    activo = m;
    visor.seleccionarMarcador(m.id);
    [...nombres.children].forEach(b => b.setAttribute('aria-pressed',String(b.dataset.elemento === m.id)));
    paginasAbort?.abort(); paginasAbort = new AbortController();
    if (!estados.has(m.id)) estados.set(m.id, {});
    const paginas = (m.paginas ?? [{id:'unica',titulo:m.titulo,parrafos:m.parrafos}])
      .map(p => ({...p, referencias:p.referencias ?? []}));
    panel.replaceChildren(crearLecturaHorizontal({secciones:[{id:m.id,titulo:m.titulo,paginas}]}, {
      signal:paginasAbort.signal, compacto:true, etiqueta:`Explicación de ${m.titulo}`, estado:estados.get(m.id)
    }));
  }
  const visor = crearVisor(recurso, { marcadores:uso.marcadores, seleccionar, signal });
  uso.marcadores.forEach(m => nombres.append(boton(m.titulo, () => seleccionar(m), {
    'data-elemento':m.id, 'aria-pressed':'false'
  })));
  const puntos = boton('👁︎', () => {
    visibles = !visibles;
    visor.mostrarPuntos(visibles); nombres.hidden = !visibles; panel.hidden = !visibles;
    const etiqueta = visibles ? 'Ocultar puntos' : 'Mostrar puntos';
    puntos.setAttribute('aria-label',etiqueta); puntos.title = etiqueta;
    puntos.setAttribute('aria-pressed',String(visibles));
    if (!visibles) ficha.open = false;
    if (visibles && !activo) seleccionar(uso.marcadores[0]);
  }, {'aria-pressed':'true', 'aria-label':'Ocultar puntos', title:'Ocultar puntos', 'data-control':'puntos'});
  if (uso.marcadores.length) visor.agregarControl(puntos);
  else { nombres.hidden = true; panel.hidden = true; }
  visor.el.append(nombres);
  const cuerpo = nodo('div', { className:'mv-explorador' }, visor.el, panel);
  signal?.addEventListener('abort', () => { paginasAbort?.abort(); visor.destruir(); }, {once:true});
  if (uso.marcadores.length) seleccionar(uso.marcadores[0]);
  const ampliar=boton('Pantalla completa',()=>{
    const modal=el.closest('dialog');
    if(modal) {
      const completa=modal.classList.toggle('mv-completa');
      ampliar.textContent=completa?'Salir de pantalla completa':'Pantalla completa';
      ampliar.setAttribute('aria-pressed',String(completa));
      modal.setAttribute('aria-label',completa?'Recurso en pantalla completa':'Recurso visual del pasaje');
    } else abrirDialogoRecurso({
      contenedor:el.closest('.mv-motor')||el.closest('.mv')||document.body,signal,contenido:el,completa:true
    });
  },{className:'mv-abrir-completa','aria-pressed':'false'});
  const ficha = nodo('details', {className:'mv-ficha-recurso'},
    nodo('summary', {title:'Información del recurso'}, nodo('h3', {}, recurso.alt),
      nodo('span', {'aria-hidden':'true'}, 'ⓘ'), nodo('span', {className:'mv-solo-lectores'}, 'Información del recurso')),
    nodo('p', {}, recurso.leyenda),
    ...[...new Set(uso.marcadores.map(m=>m.certezaHistorica).filter(t=>t && !recurso.leyenda.includes(t)))].map(t=>nodo('p',{},t)));
  el.append(ficha,...(pantallaCompleta?[ampliar]:[]),cuerpo);
  return el;
}
