import { nodo, mensaje, boton, abrirDialogoRecurso } from '../componentes/dom.js';
import { crearLector, claveVersiculo } from '../componentes/lector.js';
import { crearSelectorModo } from '../componentes/selector-modo.js';
import { crearSelectorEnfoque } from '../componentes/selector-enfoque.js';
import { crearNavegacion, crearIndiceCapitulo, relatosDelCapitulo, leerRuta, escribirRuta } from './navegacion.js';

export async function crearMotor({ root, catalogo, biblia, contenidos, inicial, usarHistorial = false, controlesPreferencias }) {
  let estado = { relatoId:catalogo.relatos[0].id, modo:'texto', enfoque:'estudio', ...inicial };
  let generacion=0,carga,destruido=false,listo=Promise.resolve();
  const eventos=new AbortController(),memorias=new Map(),educadores=new Set();
  function posicionLectura() {
    const candidatos=[...root.querySelectorAll('[data-versiculo],.mv-titulo-relato')];
    const el=candidatos.find(e=>e.getBoundingClientRect().bottom>0) || candidatos[0];
    return el && {versiculo:el.dataset.versiculo,relato:el.closest('[data-relato-contenido]').dataset.relatoContenido,top:el.getBoundingClientRect().top};
  }
  function restaurarPosicion(p) {
    if(!p)return;
    const relato=root.querySelector(`[data-relato-contenido="${p.relato}"]`);
    const el=p.versiculo?relato?.querySelector(`[data-versiculo="${p.versiculo}"]`):relato?.querySelector('.mv-titulo-relato');
    if(el)scrollBy(0,el.getBoundingClientRect().top-p.top);
  }
  function señalar() {
    root.dataset.relato=estado.relatoId;
    root.querySelectorAll('[data-relato-contenido]').forEach(e=>e.dataset.activo=String(e.dataset.relatoContenido===estado.relatoId));
    root.querySelectorAll('[data-relato-indice]').forEach(e=>e.setAttribute('aria-current',String(e.dataset.relatoIndice===estado.relatoId)));
  }
  function irAlRelato(suave=true) {
    const titulo=root.querySelector(`[data-relato-contenido="${estado.relatoId}"] .mv-titulo-relato`);
    titulo?.focus({preventScroll:true});
    titulo?.scrollIntoView({block:'start',behavior:suave&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
  }
  function cambiarEnfoque(enfoque,{historial=true}={}) {
    if(!['estudio','devocional'].includes(enfoque))throw new Error('Enfoque inválido.');
    if(destruido||estado.enfoque===enfoque)return;
    const posicion=posicionLectura();estado={...estado,enfoque};root.dataset.enfoque=enfoque;
    root.querySelectorAll('[data-enfoque]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.enfoque===enfoque)));
    if(usarHistorial&&historial)escribirRuta(estado);
    educadores.forEach(pintar=>pintar());restaurarPosicion(posicion);
  }
  function abrirRecurso(relato,uso) {
    abrirDialogoRecurso({contenedor:root,signal:carga.signal,cargar:async signal=>{
      const [recurso,{crearExplorador}]=await Promise.all([contenidos.cargarRecurso(relato,uso,{signal}),import('../componentes/explorador.js')]);
      return crearExplorador(recurso,uso,{signal});
    }});
  }
  async function montarRelato(relato,signal,vigente) {
    const titulo=nodo('h2',{className:'mv-titulo-relato',tabindex:-1,id:`relato-${relato.id}`},relato.titulo);
    const referencia=nodo('p',{className:'mv-referencia'},relato.referenciaEtiqueta);
    const cuerpo=nodo('div',{className:'mv-cuerpo'},mensaje('Cargando texto…'));
    const articulo=nodo('article',{className:'mv-relato','data-relato-contenido':relato.id,'aria-labelledby':titulo.id},titulo,referencia,cuerpo);
    root.querySelector('.mv-capitulo-lectura').append(articulo);
    try {
      const pasaje = await biblia.obtenerPasaje(relato.referencia);
      if (!vigente()) return;
      root.querySelector('.mv-libro').textContent = pasaje.libro;
      const lector = crearLector(pasaje); cuerpo.replaceChildren(lector);
      if (estado.modo === 'texto') {
        for (const versiculo of lector.querySelectorAll('[data-versiculo]')) {
          const usos = relato.recursos.filter(u => claveVersiculo({libro:u.anclajeBiblico.libro,capitulo:u.anclajeBiblico.capitulo,numero:u.anclajeBiblico.versiculo}) === versiculo.dataset.versiculo);
          if (!usos.length) continue;
          const accesos = nodo('span', {className:'mv-accesos-recurso'});
          usos.forEach((uso,i) => accesos.append(boton('🖼 Ver recurso visual', () => abrirRecurso(relato,uso), {
            className:'mv-acceso-recurso', 'data-recurso-acceso':uso.id,
            'aria-label':`Ver recurso visual ${i+1} del versículo ${uso.anclajeBiblico.versiculo}`
          })));
          versiculo.after(accesos);
        }
        return;
      }
      const estadoVisual = mensaje('Cargando recursos de demostración…'); cuerpo.append(estadoVisual);
      try {
        const [datos, { crearPortada }, { crearExplorador }, { crearLecturaHorizontal }] = await Promise.all([
          contenidos.cargarVisuales(relato,{ signal }),
          import('../componentes/portada.js'), import('../componentes/explorador.js'),
          import('../componentes/lectura-horizontal.js')
        ]);
        if (!vigente()) return;
        const recursos = new Map(datos.recursos.map(r => [r.id,r]));
        const antes = nodo('div', { className:'mv-antes-lectura' });
        const despues = nodo('div', { className:'mv-despues-lectura' });
        cuerpo.insertBefore(crearPortada(recursos.get(relato.portadaId),relato.titulo,{ pieVisible:false }),lector);
        cuerpo.insertBefore(antes,lector); lector.after(despues);
        // Agrupar por versículo conserva el orden de varios recursos en un anclaje.
        for (const versiculo of lector.querySelectorAll('[data-versiculo]')) {
          const usos = relato.recursos.filter(u => claveVersiculo({ libro:u.anclajeBiblico.libro,capitulo:u.anclajeBiblico.capitulo,numero:u.anclajeBiblico.versiculo }) === versiculo.dataset.versiculo);
          let cursor = versiculo;
          for (const uso of usos) {
            const recurso = crearExplorador(recursos.get(uso.recursoId),uso,{ signal });
            cursor.after(recurso); cursor = recurso;
          }
        }
        if (!memorias.has(relato.id)) memorias.set(relato.id,{ contexto:{}, estudio:{}, devocional:{} });
        const memoria = memorias.get(relato.id);
        let educacion;
        signal.addEventListener('abort', () => educacion?.abort(), { once:true });
        const pintarEducacion = () => {
          if (!vigente()) return;
          educacion?.abort(); educacion = new AbortController();
          antes.replaceChildren(); despues.replaceChildren();
          const secciones = datos.estudio.secciones;
          const opciones = (clase,etiqueta,estadoPagina) => ({ clase,etiqueta,estado:estadoPagina,signal:educacion.signal });
          const montar = (host,partes,config) => {
            if (partes.length) host.append(crearLecturaHorizontal({ ...datos.estudio,secciones:partes },config));
          };
          if (estado.enfoque === 'estudio') {
            montar(antes,secciones.filter(s => s.tipo === 'contexto'),opciones('mv-contexto','Contexto · Antes de leer',memoria.contexto));
            // Aplicación sigue siendo válida para los ejemplos anteriores.
            montar(despues,secciones.filter(s => ['exegesis','ensenanzas','aplicacion'].includes(s.tipo)),opciones('mv-cierre','Estudio del relato',memoria.estudio));
          } else {
            montar(despues,secciones.filter(s => s.tipo === 'devocional'),opciones('mv-cierre mv-devocional','Devocional',memoria.devocional));
          }
        };
        educadores.add(pintarEducacion);
        pintarEducacion();
        estadoVisual.remove();
      } catch (error) {
        if (vigente()) estadoVisual.textContent = 'Recursos educativos no disponibles. Podés continuar leyendo el texto.';
      }
    } catch (error) {
      if (vigente()) cuerpo.replaceChildren(mensaje('No fue posible cargar el texto. Probá seleccionar otro relato o volver a elegir el modo.'));
    }
  }
  async function renderizar(proximo=estado,{historial=true,irAlInicio=false}={}) {
    if(destruido)return;
    proximo={...proximo,enfoque:proximo.enfoque??'estudio'};
    if(!['texto','visual'].includes(proximo.modo))throw new Error('Modo inválido.');
    if(!['estudio','devocional'].includes(proximo.enfoque))throw new Error('Enfoque inválido.');
    if(!catalogo.relatos.some(r=>r.id===proximo.relatoId))throw new Error('Relato inexistente.');
    const relatos=relatosDelCapitulo(catalogo,proximo.relatoId);
    const mismoCapitulo=relatos.some(r=>r.id===estado.relatoId)&&root.querySelector('.mv-capitulo-lectura');
    if(mismoCapitulo&&estado.modo===proximo.modo) {
      const cambia=estado.relatoId!==proximo.relatoId;
      cambiarEnfoque(proximo.enfoque,{historial:false});estado={...proximo};señalar();
      if(usarHistorial&&historial)escribirRuta(estado);
      const turno=generacion;await listo;
      if(!destruido&&turno===generacion&&(cambia||irAlInicio))irAlRelato();
      return;
    }
    const posicion=mismoCapitulo?posicionLectura():null;
    const focoModo=root.contains(document.activeElement)&&document.activeElement?.dataset.modo;
    carga?.abort();carga=new AbortController();educadores.clear();const {signal}=carga,turno=++generacion;
    const vigente=()=>!destruido&&!signal.aborted&&turno===generacion;
    estado={...proximo};root.dataset.modo=estado.modo;root.dataset.enfoque=estado.enfoque;
    if(usarHistorial&&historial)escribirRuta(estado);
    const seleccionar=relatoId=>renderizar({...estado,relatoId},{irAlInicio:true});
    const cabecera=nodo('header',{className:'mv-barra-lector','aria-label':'Controles del lector'},
      nodo('div',{className:'mv-selectores'},crearSelectorEnfoque(estado.enfoque,cambiarEnfoque),crearSelectorModo(estado.modo,modo=>renderizar({...estado,modo}))));
    if(controlesPreferencias)cabecera.append(controlesPreferencias);
    root.replaceChildren(cabecera,crearIndiceCapitulo(catalogo,estado.relatoId,seleccionar),
      nodo('div',{className:'mv-capitulo-lectura'}),crearNavegacion(catalogo,estado.relatoId,seleccionar));
    // Cada relato usa la misma composición; los lugares se insertan en orden antes
    // de esperar respuestas, de modo que una carga lenta nunca reordena versículos.
    listo=Promise.all(relatos.map(relato=>montarRelato(relato,signal,vigente)));señalar();
    if(focoModo)root.querySelector(`[data-modo="${estado.modo}"]`)?.focus({preventScroll:true});
    await listo;
    if(!vigente())return;
    if(posicion)restaurarPosicion(posicion);
    else if(irAlInicio||estado.relatoId!==relatos[0].id)irAlRelato(false);
  }
  if(usarHistorial)window.addEventListener('popstate',()=>renderizar(leerRuta(location.search,catalogo),{historial:false}),{signal:eventos.signal});
  await renderizar(estado,{historial:false});
  return {
    cambiarModo:modo=>renderizar({...estado,modo}),cambiarEnfoque,
    seleccionar:relatoId=>renderizar({...estado,relatoId},{irAlInicio:true}),
    obtenerEstado:()=>({...estado}),
    destruir(){destruido=true;generacion++;carga?.abort();educadores.clear();eventos.abort();root.replaceChildren();}
  };
}
