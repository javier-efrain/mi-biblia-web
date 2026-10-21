import {test,assert,conMotor,datos,frame,esperar,diferida} from './harness.js';
import {crearLecturaHorizontal} from '../js/componentes/lectura-horizontal.js';
import {crearServicioContenidos} from '../js/servicios/contenidos.js';
test('Solo texto monta accesos anclados y carga solo el recurso solicitado, sin estudios', async () => {
  const solicitudes=[],d=await datos();
  const contenidos=crearServicioContenidos({baseURL:new URL('../datos/',import.meta.url),fetcher:(url,op)=>{solicitudes.push(String(url));return fetch(url,op);}});
  await conMotor(async ({root,motor}) => {
    assert(solicitudes.length===0 && !root.querySelector('img,dialog,[data-educativo]'));
    const icono=root.querySelector('[data-recurso-acceso]');icono.focus();icono.click();
    await esperar(()=>root.querySelector('dialog .mv-visor'));
    assert(root.querySelectorAll('.mv-recurso').length===1 && root.querySelectorAll('img').length===1);
    assert(solicitudes.length===1 && solicitudes[0].endsWith('recursos.json'));
    assert(motor.obtenerEstado().modo==='texto');
    const modal=root.querySelector('dialog');root.querySelector('[data-elemento="punto-b"]').click();
    await motor.cambiarEnfoque('devocional');
    assert(root.querySelector('dialog')===modal && root.querySelector('[data-marcador="punto-b"]').getAttribute('aria-pressed')==='true');
    [...modal.querySelectorAll('button')].find(b=>b.textContent==='Cerrar recurso').click();
    await frame();assert(!root.querySelector('[data-educativo],img,dialog') && document.activeElement===icono);
    assert(motor.obtenerEstado().modo==='texto' && motor.obtenerEstado().enfoque==='devocional');
  },{contenidos,inicial:{relatoId:d.catalogo.relatos[1].id,modo:'texto'}});
});
test('Cerrar durante una carga tardía impide montar el recurso y libera el fondo', async () => {
  const espera=diferida(),d=await datos();
  await conMotor(async ({root}) => {
    root.querySelector('[data-recurso-acceso]').click();
    const modal=root.querySelector('dialog');assert(modal.open);
    modal.querySelector('button').click();
    espera.resolver(await d.contenidos.cargarRecurso(d.catalogo.relatos[0],d.catalogo.relatos[0].recursos[0]));
    await frame();assert(!root.querySelector('dialog,img') && !document.body.classList.contains('mv-modal-abierto'));
  },{contenidos:{cargarRecurso:()=>espera.promesa}});
});
test('La navegación de capítulos queda después de la lectura en ambos modos', async () => {
  await conMotor(async ({root,motor}) => {
    for (const modo of ['texto','visual']) {
      await motor.cambiarModo(modo);
      const articulo=root.querySelector('.mv-relato'),nav=root.querySelector('.mv-navegacion');
      assert(Boolean(articulo.compareDocumentPosition(nav)&Node.DOCUMENT_POSITION_FOLLOWING));
      assert(root.lastElementChild===nav && nav.querySelectorAll('button').length===2);
      assert(![...root.querySelectorAll('.mv-recurso > button')].some(b=>b.textContent==='Ampliar visor'));
    }
  });
});
test('La paginación conserva altura y permite acceder a cada carácter del texto completo', async () => {
  const raiz=document.createElement('div');raiz.className='mv';raiz.style.width='320px';document.body.append(raiz);
  const abort=new AbortController();
  const paginas=[{id:'a',titulo:'DEMO',parrafos:[('Texto completo de prueba, sin recortes. ').repeat(45)],referencias:['FIN A']},
    {id:'b',titulo:'Continuación',parrafos:[('Segundo texto accesible. ').repeat(20)],referencias:['FIN B']}];
  try {
    for (const tamano of [12,30]) {
      raiz.style.setProperty('--mv-tamano-lectura',`${tamano}px`);
      const pager=crearLecturaHorizontal({secciones:[{id:'prueba',titulo:'Prueba',paginas}]},{signal:abort.signal});raiz.replaceChildren(pager);
      await frame();const hoja=pager.querySelector('.mv-hoja'),altura=hoja.clientHeight,vistos=new Set();
      const esperados=paginas.reduce((n,p)=>n+(p.titulo+p.parrafos.join('')+p.referencias.join(' · ')).replace(/\s/g,'').length,0);
      const total=Number(pager.querySelector('output').textContent.split('/')[1]);assert(total>2 && altura<=260);
      for (let paso=0;paso<total;paso++) {
        const texto=hoja.firstChild.textContent,fuente=texto.startsWith('DEMO')?'a':'b';
        const walker=document.createTreeWalker(hoja.firstChild,NodeFilter.SHOW_TEXT),r=document.createRange(),h=hoja.getBoundingClientRect();
        let node,offset=0;
        while ((node=walker.nextNode())) {
          for(let i=0;i<node.length;i++) if (!/\s/.test(node.textContent[i])) {
            r.setStart(node,i);r.setEnd(node,i+1);const rect=r.getBoundingClientRect();
            if(rect.left>=h.left-1 && rect.right<=h.right+1 && rect.top>=h.top-1 && rect.bottom<=h.bottom+1) vistos.add(`${fuente}:${offset+i}`);
          }
          offset+=node.length;
        }
        assert(hoja.clientHeight===altura,'Una página larga expandió la caja');
        if(paso<total-1) {pager.querySelector('nav button:last-child').click();await frame();}
      }
      assert(pager.querySelector('nav button:last-child').disabled);
      assert(vistos.size===esperados,`${tamano}px: accesibles ${vistos.size}/${esperados} caracteres`);
    }
  } finally {abort.abort();raiz.remove();}
});
