// Todo el contenido editorial se inserta como texto, nunca como HTML.
export function nodo(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) el.setAttribute(key, String(value));
  }
  el.append(...children.filter(x => x != null));
  return el;
}
export function boton(texto, accion, attrs = {}) {
  return nodo('button', { type: 'button', ...attrs, onclick: accion }, texto);
}
export function mensaje(texto) {
  return nodo('p', { role: 'status', className: 'mv-aviso' }, texto);
}

// Un solo ciclo modal para recursos bajo demanda y el explorador trasladado.
export function abrirDialogoRecurso({contenedor,signal,contenido,cargar,completa=false}) {
  if (signal?.aborted || document.querySelector('dialog[open]')) return null;
  const disparador=document.activeElement, x=scrollX, y=scrollY, local=new AbortController();
  const dialogo=nodo('dialog',{className:`mv-dialogo${completa?' mv-completa':''}`,'aria-label':completa?'Recurso en pantalla completa':'Recurso visual del pasaje','data-educativo':'modal-recurso'});
  const cerrar=boton(completa?'Cerrar pantalla completa':'Cerrar recurso',()=>limpiar(true));
  const host=nodo('div',{},contenido ? null : mensaje('Cargando recurso…'));
  let sitio,limpio=false;
  if (contenido) {
    sitio=nodo('div',{'aria-hidden':'true'});sitio.style.height=`${contenido.getBoundingClientRect().height}px`;
    contenido.before(sitio);host.append(contenido);
  }
  dialogo.append(cerrar,host);contenedor.append(dialogo);
  const bloqueado=document.body.classList.contains('mv-modal-abierto');document.body.classList.add('mv-modal-abierto');
  function limpiar(restaurar) {
    if(limpio)return;limpio=true;local.abort();
    const devolver=dialogo.contains(document.activeElement)||document.activeElement===document.body||document.activeElement===disparador;
    if(dialogo.open)dialogo.close();
    if(sitio?.isConnected){sitio.replaceWith(contenido);}
    dialogo.remove();if(!bloqueado)document.body.classList.remove('mv-modal-abierto');
    if(restaurar&&devolver&&!signal?.aborted&&disparador?.isConnected){
      disparador.focus({preventScroll:true});scrollTo(x,y);
      requestAnimationFrame(()=>{if(!signal?.aborted&&document.activeElement===disparador&&!document.querySelector('dialog[open]'))scrollTo(x,y);});
    }
  }
  dialogo.addEventListener('close',()=>limpiar(true));
  signal?.addEventListener('abort',()=>limpiar(false),{once:true,signal:local.signal});
  dialogo.showModal();cerrar.focus({preventScroll:true});
  if(cargar)Promise.resolve().then(()=>cargar(local.signal)).then(el=>{
    if(!local.signal.aborted)host.replaceChildren(el);
  }).catch(()=>{if(!local.signal.aborted)host.replaceChildren(mensaje('No fue posible cargar el recurso. Podés cerrar y continuar leyendo.'));});
  return dialogo;
}
