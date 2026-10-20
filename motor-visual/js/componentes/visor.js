import { nodo, boton } from './dom.js';
export function crearVisor(recurso, { marcadores = [], seleccionar = () => {}, signal } = {}) {
  const eventos = new AbortController();
  const localSignal = eventos.signal;
  const el = nodo('section', { className:'mv-visor', 'data-educativo':'visor', 'aria-label':'Visor educativo 3:4' });
  const viewport = nodo('div', { className:'mv-viewport', tabindex:0, 'aria-label':'Imagen ampliable. Usá los controles de zoom y desplazá la imagen.' });
  const escena = nodo('div', { className:'mv-escena' });
  const plano = nodo('div', { className:'mv-plano' });
  const imagen = nodo('img', { src:recurso.src, alt:recurso.alt, draggable:'false' });
  plano.append(imagen); escena.append(plano); viewport.append(escena);
  let zoom = 1;
  const salida = nodo('output', { 'aria-live':'polite' }, '100 %');
  const rango = nodo('input', { type:'range', min:100, max:400, step:25, value:100, 'aria-label':'Nivel de zoom' });
  const marcadoresDOM = marcadores.map((m,i) => {
    const b = boton(String(i+1), () => {
      marcadoresDOM.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      seleccionar(m);
    }, { className:'mv-marcador', 'aria-label':m.titulo, 'aria-pressed':'false', 'data-marcador':m.id });
    b.style.left = `${m.x * 100}%`; b.style.top = `${m.y * 100}%`;
    plano.append(b); return b;
  });
  function dibujar() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    const factor = Math.min(w / recurso.dimensiones.ancho, h / recurso.dimensiones.alto);
    const ancho = recurso.dimensiones.ancho * factor * zoom;
    const alto = recurso.dimensiones.alto * factor * zoom;
    escena.style.width = `${w * zoom}px`; escena.style.height = `${h * zoom}px`;
    Object.assign(plano.style, { width:`${ancho}px`, height:`${alto}px`, left:`${(w * zoom - ancho)/2}px`, top:`${(h * zoom - alto)/2}px` });
    rango.value = zoom * 100; salida.textContent = `${zoom * 100} %`;
  }
  function ampliar(valor) {
    const anterior = zoom;
    zoom = Math.max(1, Math.min(4, valor));
    const x = viewport.scrollLeft + viewport.clientWidth / 2;
    const y = viewport.scrollTop + viewport.clientHeight / 2;
    dibujar();
    viewport.scrollLeft = x * zoom / anterior - viewport.clientWidth / 2;
    viewport.scrollTop = y * zoom / anterior - viewport.clientHeight / 2;
  }
  rango.addEventListener('input', () => ampliar(Number(rango.value)/100), { signal:localSignal });
  viewport.addEventListener('keydown', e => {
    if (e.target !== viewport) return;
    if (['+','-','0'].includes(e.key)) {
      e.preventDefault(); ampliar(e.key === '0' ? 1 : zoom + (e.key === '+' ? .25 : -.25));
    }
  }, { signal:localSignal });
  // El arrastre con ratón complementa barras y teclado; el tacto usa scroll nativo.
  let arrastre = null;
  viewport.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || zoom === 1 || e.target.closest('button')) return;
    arrastre = {id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, {signal:localSignal});
  viewport.addEventListener('pointermove', e => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    viewport.scrollTo(arrastre.left + arrastre.x-e.clientX, arrastre.top + arrastre.y-e.clientY);
  }, {signal:localSignal});
  function terminarArrastre(e) {
    if (arrastre?.id !== e.pointerId) return;
    arrastre = null;
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
  }
  viewport.addEventListener('pointerup', terminarArrastre, {signal:localSignal});
  viewport.addEventListener('pointercancel', terminarArrastre, {signal:localSignal});
  imagen.addEventListener('error', () => {
    plano.replaceChildren(nodo('p', { role:'status' }, 'Imagen no disponible. El texto continúa disponible.'));
  }, { signal:localSignal });
  const controles = nodo('div', { className:'mv-controles' },
    boton('−', () => ampliar(zoom-.25), { 'aria-label':'Reducir zoom' }), rango,
    boton('+', () => ampliar(zoom+.25), { 'aria-label':'Aumentar zoom' }), salida,
    boton('Restablecer', () => { ampliar(1); viewport.scrollTo(0,0); }));
  el.append(viewport, controles, nodo('small', {}, recurso.leyenda));
  const observador = new ResizeObserver(dibujar); observador.observe(viewport);
  function destruir() { observador.disconnect(); eventos.abort(); }
  if (signal?.aborted) destruir(); else signal?.addEventListener('abort', destruir, { once:true });
  requestAnimationFrame(() => { if (!localSignal.aborted) dibujar(); });
  return { el, ampliar, destruir, viewport, plano,
    seleccionarMarcador(id) { marcadoresDOM.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.marcador === id))); },
    mostrarPuntos(visible) { marcadoresDOM.forEach(b => { b.hidden = !visible; }); }
  };
}
