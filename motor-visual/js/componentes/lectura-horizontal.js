import { nodo, boton } from './dom.js';
// Las columnas del navegador dividen el texto sin truncarlo ni duplicarlo.
export function crearLecturaHorizontal(estudio, { signal, clase = '', etiqueta = 'Estudio del relato', estado = {}, compacto = false } = {}) {
  let seccion = Math.max(0,estudio.secciones.findIndex(s => s.id === estado.seccion));
  estado.paginas ??= Object.create(null);
  let pagina = 0, columna = 0, cuentas = [], inicio = null, pendiente = 0, contenidoActual = null, fuenteActual = '';
  const eventos = new AbortController();
  const el = nodo('section', { className:`mv-estudio ${clase}`, 'data-educativo':'estudio', 'aria-label':etiqueta });
  const selectores = nodo('div', { className:'mv-pestanas', role:'group', 'aria-label':'Secciones educativas' });
  const hoja = nodo('div', { className:'mv-hoja', tabindex:0, 'aria-label':'Explicación paginada. Usá flecha izquierda o derecha para cambiar de página.' });
  const contador = nodo('output', { 'aria-live':'polite' });
  const anterior = boton('← Anterior', () => mover(-1));
  const siguiente = boton('Siguiente →', () => mover(1));
  const nav = nodo('nav', { className:'mv-controles','aria-label':'Páginas de explicación' },anterior,contador,siguiente);
  const paginas = () => estudio.secciones[seccion].paginas;
  function recuperar() {
    const n = estado.paginas[estudio.secciones[seccion].id];
    pagina = Math.max(0,Math.min(Number.isInteger(n) ? n : n?.pagina || 0,paginas().length-1));
    columna = Math.max(0,n?.columna || 0);
  }
  function articulo(p) {
    return nodo('article', {className:'mv-pagina-columnas'}, nodo(compacto ? 'h4' : 'h3', {}, p.titulo),
      ...p.parrafos.map(t => nodo('p', {}, t)), nodo('small', {}, p.referencias.join(' · ')));
  }
  function indice() { return cuentas.slice(0,pagina).reduce((a,b) => a+b,0)+columna; }
  function pintar(animar = 0) {
    const s = estudio.secciones[seccion];
    const clave = `${seccion}:${pagina}`;
    if (fuenteActual !== clave) {
      contenidoActual = articulo(paginas()[pagina]); hoja.replaceChildren(contenidoActual); fuenteActual = clave;
    }
    const ancho = contenidoActual.clientWidth, paso = ancho+24;
    hoja.scrollLeft = columna*paso;
    const total = cuentas.reduce((a,b) => a+b,0) || paginas().length;
    contador.textContent = `${indice()+1} / ${total}`;
    anterior.disabled = indice() === 0; siguiente.disabled = indice() >= total-1;
    nav.hidden = compacto && total === 1;
    estado.seccion = s.id; estado.paginas[s.id] = {pagina,columna}; el.dataset.seccion = s.id;
    [...selectores.children].forEach((b,i) => b.setAttribute('aria-pressed',String(i === seccion)));
    if (animar && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Animar el marco, no los párrafos: las columnas mantienen sus posiciones.
      hoja.animate([{opacity:.65,transform:`translateX(${animar*10}px)`},{opacity:1,transform:'translateX(0)'}],{duration:160});
    }
  }
  function medir() {
    if (!el.isConnected || !hoja.clientWidth) return;
    const estilo = getComputedStyle(hoja);
    const ancho = hoja.clientWidth-parseFloat(estilo.paddingLeft)-parseFloat(estilo.paddingRight);
    const alto = hoja.clientHeight-parseFloat(estilo.paddingTop)-parseFloat(estilo.paddingBottom);
    cuentas = paginas().map((p,i) => {
      const actual = fuenteActual === `${seccion}:${i}`;
      const a = actual ? contenidoActual : articulo(p);
      if (!actual) {
        Object.assign(a.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',left:'0',top:'0',width:`${ancho}px`,height:`${alto}px`});
        hoja.append(a);
      }
      const n = Math.max(1,Math.round((a.scrollWidth+24)/(a.clientWidth+24)));
      if (!actual) a.remove();
      return n;
    });
    columna = Math.min(columna,cuentas[pagina]-1);
    pintar();
  }
  function programar() {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => { if (!eventos.signal.aborted) medir(); });
  }
  function mover(delta) {
    medir();
    const n = indice()+delta, total = cuentas.reduce((a,b) => a+b,0);
    if (n < 0 || n >= total) return;
    let resto = n; pagina = 0;
    while (resto >= cuentas[pagina]) resto -= cuentas[pagina++];
    columna = resto; pintar(delta);
  }
  estudio.secciones.forEach((s,i) => selectores.append(boton(s.titulo, () => {
    seccion=i; recuperar(); cuentas=[]; medir();
  }, { 'aria-pressed':String(i===seccion) })));
  hoja.addEventListener('keydown', e => {
    if (e.target === hoja && ['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); mover(e.key==='ArrowRight'?1:-1); }
  }, {signal:eventos.signal});
  hoja.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') inicio = e.isPrimary ? [e.clientX,e.clientY,e.pointerId] : null;
  }, {signal:eventos.signal});
  hoja.addEventListener('pointerup', e => {
    if (!inicio) return;
    const [x,y,id] = inicio; inicio=null;
    if (e.pointerId === id && Math.abs(e.clientX-x)>60 && Math.abs(e.clientX-x)>Math.abs(e.clientY-y)*1.5) mover(e.clientX<x?1:-1);
  }, {signal:eventos.signal});
  hoja.addEventListener('pointercancel', () => { inicio=null; }, {signal:eventos.signal});
  if (!compacto) el.append(nodo('h2', {className:'mv-titulo-seccion'},etiqueta));
  if (estudio.secciones.length > 1) el.append(selectores);
  el.append(hoja,nav); recuperar(); cuentas=paginas().map(() => 1); pintar();
  const resize = new ResizeObserver(programar); resize.observe(hoja);
  const cambios = new MutationObserver(programar);
  requestAnimationFrame(() => {
    if (!eventos.signal.aborted && el.isConnected) {
      cambios.observe(el.closest('.mv') || document.body,{attributes:true,attributeFilter:['style','data-apariencia']});
      medir();
    }
  });
  function destruir() { cancelAnimationFrame(pendiente); resize.disconnect(); cambios.disconnect(); eventos.abort(); }
  if (signal?.aborted) destruir(); else signal?.addEventListener('abort',destruir,{once:true});
  return el;
}
