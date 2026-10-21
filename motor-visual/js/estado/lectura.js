import { nodo, mensaje, boton } from '../componentes/dom.js';
import { crearLector, claveVersiculo } from '../componentes/lector.js';
import { crearSelectorModo } from '../componentes/selector-modo.js';
import { crearSelectorEnfoque } from '../componentes/selector-enfoque.js';
import { crearNavegacion, crearIndiceCapitulo, leerRuta, escribirRuta } from './navegacion.js';

// Los módulos visuales no forman parte de la ruta inicial de Solo texto.
export async function crearMotor({ root, catalogo, biblia, contenidos, inicial, usarHistorial = false, controlesPreferencias }) {
  let estado = { relatoId:catalogo.relatos[0].id, modo:'texto', enfoque:'estudio', ...inicial };
  let generacion = 0, carga = null, destruido = false, pintarEducacion = null;
  const eventos = new AbortController(), memorias = new Map();
  function enfocarInicio(titulo) {
    titulo.focus({ preventScroll:true });
    titulo.scrollIntoView({ block:'start', behavior:'instant' });
  }
  function cambiarEnfoque(enfoque, { historial = true } = {}) {
    if (!['estudio','devocional'].includes(enfoque)) throw new Error('Enfoque inválido.');
    if (destruido || estado.enfoque === enfoque) return;
    estado = { ...estado, enfoque }; root.dataset.enfoque = enfoque;
    root.querySelectorAll('[data-enfoque]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.enfoque === enfoque)));
    if (usarHistorial && historial) escribirRuta(estado);
    // Cambiar el enfoque no recarga ni reconstruye versículos, imágenes o visores.
    pintarEducacion?.();
  }
  async function renderizar(proximo = estado, { historial = true, irAlInicio = false } = {}) {
    if (destruido) return;
    const enfoque = proximo.enfoque ?? 'estudio';
    if (!['texto','visual'].includes(proximo.modo)) throw new Error('Modo inválido.');
    if (!['estudio','devocional'].includes(enfoque)) throw new Error('Enfoque inválido.');
    const relato = catalogo.relatos.find(r => r.id === proximo.relatoId);
    if (!relato) throw new Error('Relato inexistente.');
    const tituloActual = root.querySelector('.mv-titulo-relato');
    if (irAlInicio && tituloActual && proximo.relatoId === estado.relatoId && proximo.modo === estado.modo && enfoque === estado.enfoque) {
      // Volver al relato activo no debe reiniciar su visor ni sus páginas.
      enfocarInicio(tituloActual); return;
    }
    if (proximo.relatoId === estado.relatoId && proximo.modo === estado.modo && enfoque !== estado.enfoque) {
      cambiarEnfoque(enfoque,{ historial }); return;
    }
    const focoDentro = root.contains(document.activeElement);
    const focoModo = focoDentro && document.activeElement?.dataset.modo;
    carga?.abort(); carga = new AbortController(); pintarEducacion = null;
    const { signal } = carga;
    const turno = ++generacion;
    estado = { relatoId:relato.id, modo:proximo.modo, enfoque };
    if (usarHistorial && historial) escribirRuta(estado);
    const vigente = () => !destruido && !signal.aborted && turno === generacion;
    root.dataset.modo = estado.modo; root.dataset.relato = relato.id; root.dataset.enfoque = enfoque;
    const titulo = nodo('h2', { className:'mv-titulo-relato', tabindex:-1 }, relato.titulo);
    const referencia = nodo('p', { className:'mv-referencia' }, relato.referenciaEtiqueta);
    const cuerpo = nodo('div', { className:'mv-cuerpo' }, mensaje('Cargando texto…'));
    const cambiarModo = modo => renderizar({ ...estado, modo });
    const seleccionar = relatoId => renderizar({ ...estado, relatoId },{ irAlInicio:true });
    const cabecera = nodo('header', { className:'mv-barra-lector', 'aria-label':'Controles del lector' },
      nodo('div', { className:'mv-selectores' }, crearSelectorEnfoque(enfoque,cambiarEnfoque),crearSelectorModo(estado.modo,cambiarModo)));
    if (controlesPreferencias) cabecera.append(controlesPreferencias);
    const capitulo = crearIndiceCapitulo(catalogo,relato.id,seleccionar);
    root.replaceChildren(cabecera,capitulo,
      nodo('article', { className:'mv-relato' },titulo,referencia,cuerpo),crearNavegacion(catalogo,relato.id,seleccionar));
    if (focoModo) root.querySelector(`[data-modo="${estado.modo}"]`)?.focus();
    else if (focoDentro) titulo.focus({ preventScroll:true });
    async function abrirRecurso(uso) {
      if (!vigente() || root.querySelector('dialog[open]')) return;
      const disparador = document.activeElement, x = scrollX, y = scrollY;
      const local = new AbortController();
      const dialogo = nodo('dialog', {className:'mv-dialogo','aria-label':'Recurso visual del pasaje','data-educativo':'modal-recurso'});
      const cerrar = boton('Cerrar recurso', () => { dialogo.close(); limpiar(true); });
      const contenido = nodo('div', {}, mensaje('Cargando recurso…'));
      dialogo.append(cerrar,contenido); root.append(dialogo);
      const estabaBloqueado = document.body.classList.contains('mv-modal-abierto');
      document.body.classList.add('mv-modal-abierto');
      let limpio = false;
      function limpiar(restaurar) {
        if (limpio) return; limpio = true; local.abort();
        const devolver = dialogo.contains(document.activeElement) || document.activeElement === document.body || document.activeElement === disparador;
        if (dialogo.open) dialogo.close();
        dialogo.remove();
        if (!estabaBloqueado) document.body.classList.remove('mv-modal-abierto');
        if (restaurar && devolver && vigente() && disparador?.isConnected) {
          disparador.focus({preventScroll:true}); window.scrollTo(x,y);
          requestAnimationFrame(() => { if (vigente() && document.activeElement === disparador && !document.querySelector('dialog[open]')) window.scrollTo(x,y); });
        }
      }
      dialogo.addEventListener('close', () => limpiar(true));
      signal.addEventListener('abort', () => limpiar(false), {once:true,signal:local.signal});
      dialogo.showModal(); cerrar.focus({preventScroll:true});
      try {
        const [recurso,{crearExplorador}] = await Promise.all([
          contenidos.cargarRecurso(relato,uso,{signal:local.signal}),import('../componentes/explorador.js')
        ]);
        if (local.signal.aborted || !vigente()) return;
        contenido.replaceChildren(crearExplorador(recurso,uso,{signal:local.signal}));
      } catch (error) {
        if (!local.signal.aborted && vigente()) contenido.replaceChildren(mensaje('No fue posible cargar el recurso. Podés cerrar esta ventana y continuar leyendo.'));
      }
    }
    try {
      const pasaje = await biblia.obtenerPasaje(relato.referencia);
      if (!vigente()) return;
      capitulo.querySelector('.mv-libro').textContent = pasaje.libro;
      const lector = crearLector(pasaje); cuerpo.replaceChildren(lector);
      if (estado.modo === 'texto') {
        for (const versiculo of lector.querySelectorAll('[data-versiculo]')) {
          const usos = relato.recursos.filter(u => claveVersiculo({libro:u.anclajeBiblico.libro,capitulo:u.anclajeBiblico.capitulo,numero:u.anclajeBiblico.versiculo}) === versiculo.dataset.versiculo);
          if (!usos.length) continue;
          const accesos = nodo('span', {className:'mv-accesos-recurso'});
          usos.forEach((uso,i) => accesos.append(boton('▧', () => abrirRecurso(uso), {
            className:'mv-acceso-recurso', 'data-recurso-acceso':uso.id,
            'aria-label':`Abrir recurso visual ${i+1} del versículo ${uso.anclajeBiblico.versiculo}`
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
        pintarEducacion = () => {
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
        pintarEducacion();
        estadoVisual.remove();
      } catch (error) {
        if (vigente()) estadoVisual.textContent = 'Recursos educativos no disponibles. Podés continuar leyendo el texto.';
      }
    } catch (error) {
      if (vigente()) cuerpo.replaceChildren(mensaje('No fue posible cargar el texto. Probá seleccionar otro relato o volver a elegir el modo.'));
    } finally {
      // Esperar la carga y el montaje evita que el navegador ajuste el destino al reemplazar el relato.
      // Una respuesta tardía nunca debe desplazar la lectura del relato elegido después.
      if (irAlInicio && vigente()) {
        enfocarInicio(titulo);
      }
    }
  }
  if (usarHistorial) window.addEventListener('popstate', () => renderizar(leerRuta(location.search,catalogo), { historial:false }), { signal:eventos.signal });
  await renderizar(estado, { historial:false });
  return {
    cambiarModo: modo => renderizar({ ...estado,modo }),
    cambiarEnfoque,
    seleccionar: relatoId => renderizar({ ...estado,relatoId },{ irAlInicio:true }),
    obtenerEstado: () => ({ ...estado }),
    destruir() { destruido=true; generacion++; carga?.abort(); pintarEducacion=null; eventos.abort(); root.replaceChildren(); }
  };
}
