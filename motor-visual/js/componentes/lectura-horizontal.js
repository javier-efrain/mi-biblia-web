import { nodo, boton } from './dom.js';
// El mismo paginador sirve para contexto, cierre de estudio y devocional.
export function crearLecturaHorizontal(estudio, { signal, clase = '', etiqueta = 'Estudio del relato', estado = {} } = {}) {
  let seccion = Math.max(0,estudio.secciones.findIndex(s => s.id === estado.seccion)), inicio = null;
  estado.paginas ??= Object.create(null);
  let pagina = paginaGuardada();
  const eventos = new AbortController();
  const el = nodo('section', { className:`mv-estudio ${clase}`, 'data-educativo':'estudio', 'aria-label':etiqueta });
  const selectores = nodo('div', { className:'mv-pestanas', role:'group', 'aria-label':'Secciones educativas' });
  const hoja = nodo('div', { className:'mv-hoja', tabindex:0, 'aria-live':'polite', 'aria-label':'Explicación. Usá flecha izquierda o derecha para cambiar de página.' });
  const contador = nodo('output', { 'aria-live':'polite' });
  const anterior = boton('← Anterior', () => mover(-1));
  const siguiente = boton('Siguiente →', () => mover(1));
  function paginaGuardada() {
    const s = estudio.secciones[seccion], n = estado.paginas[s.id];
    return Number.isInteger(n) ? Math.max(0,Math.min(n,s.paginas.length-1)) : 0;
  }
  function pintar() {
    const s = estudio.secciones[seccion], p = s.paginas[pagina];
    estado.seccion = s.id; estado.paginas[s.id] = pagina; el.dataset.seccion = s.id;
    const contenido = nodo('article', {}, nodo('h3', {}, p.titulo), ...p.parrafos.map(t => nodo('p', {}, t)), nodo('small', {}, p.referencias.join(' · ')));
    hoja.replaceChildren(contenido);
    contador.textContent = `${pagina+1} / ${s.paginas.length}`;
    anterior.disabled = pagina === 0; siguiente.disabled = pagina === s.paginas.length-1;
    [...selectores.children].forEach((b,i) => b.setAttribute('aria-pressed',String(i === seccion)));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) contenido.animate([{ opacity:.4, transform:'translateX(8px)' },{ opacity:1, transform:'translateX(0)' }],{ duration:150 });
  }
  function mover(delta) {
    const n = pagina+delta;
    if (n >= 0 && n < estudio.secciones[seccion].paginas.length) { pagina = n; pintar(); }
  }
  estudio.secciones.forEach((s,i) => selectores.append(boton(s.titulo, () => { seccion=i; pagina=paginaGuardada(); pintar(); }, { 'aria-pressed':String(i===seccion) })));
  hoja.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); mover(e.key==='ArrowRight'?1:-1); }
  }, { signal:eventos.signal });
  hoja.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.isPrimary) inicio = [e.clientX,e.clientY]; }, { signal:eventos.signal });
  hoja.addEventListener('pointerup', e => {
    if (!inicio) return;
    const [x,y] = inicio; inicio=null;
    if (Math.abs(e.clientX-x)>60 && Math.abs(e.clientX-x)>Math.abs(e.clientY-y)*1.5) mover(e.clientX<x?1:-1);
  }, { signal:eventos.signal });
  hoja.addEventListener('pointercancel', () => { inicio=null; }, { signal:eventos.signal });
  signal?.addEventListener('abort', () => eventos.abort(), { once:true });
  el.append(nodo('h2', { className:'mv-titulo-seccion' },etiqueta));
  if (estudio.secciones.length > 1) el.append(selectores);
  el.append(hoja,nodo('nav', { className:'mv-controles','aria-label':'Páginas de explicación' },anterior,contador,siguiente));
  pintar(); return el;
}
