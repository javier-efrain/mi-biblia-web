import { ajustarZoom } from './harness.js';
import {test,assert,conMotor,datos,frame,esperar,rechaza} from './harness.js';
import {composicionLectura} from '../js/componentes/selector-enfoque.js';
import {crearServicioContenidos} from '../js/servicios/contenidos.js';

test('Las cuatro combinaciones editoriales conservan el capítulo y sus contenidos correspondientes',async()=>{
  await conMotor(async({root,motor})=>{
    for(const modo of ['visual','texto'])for(const enfoque of ['estudio','devocional']){
      await motor.cambiarModo(modo);await motor.cambiarEnfoque(enfoque);await frame();
      assert(root.querySelectorAll('.mv-relato').length===2);
      assert(root.querySelectorAll('.mv-texto [data-versiculo]').length===4);
      assert(root.querySelectorAll('.mv-portada').length===(modo==='visual'?2:0));
      assert(root.querySelectorAll('.mv-contexto').length===(enfoque==='estudio'?2:0));
      assert(root.querySelectorAll('.mv-devocional').length===(enfoque==='devocional'?2:0));
      assert(root.querySelectorAll('.mv-cierre').length===2);
      assert(root.querySelectorAll('.mv-recurso').length===(modo==='visual'&&enfoque==='estudio'?3:0));
      assert(root.querySelectorAll('[data-recurso-acceso]').length===(modo==='texto'?3:0));
      assert(!root.querySelector('.mv-abrir-completa'));
    }
  });
});
test('Volver a Estudio reutiliza visores, zoom, puntos ocultos y paginación',async()=>{
  await conMotor(async({root,motor})=>{
    await motor.cambiarModo('visual');const e=root.querySelector('.mv-recurso'),v=e.querySelector('.mv-visor'),r=e.querySelector('[data-zoom]');
    ajustarZoom(r,250);e.querySelector('[data-elemento="punto-b"]').click();e.querySelector('.mv-panel nav button:last-child').click();
    e.querySelector('[data-control="puntos"]').click();
    await motor.cambiarEnfoque('devocional');assert(!e.isConnected&&!root.querySelector('.mv-recurso'));
    await motor.cambiarEnfoque('estudio');await frame();
    assert(root.querySelector('.mv-recurso')===e&&e.querySelector('.mv-visor')===v&&r.dataset.zoom==='250');
    assert(e.querySelector('[data-control="puntos"]').getAttribute('aria-label')==='Mostrar puntos');
    e.querySelector('[data-control="puntos"]').click();assert(e.querySelector('.mv-panel output').textContent.startsWith('2 / '));
    assert(e.querySelector('[data-marcador="punto-b"]').getAttribute('aria-pressed')==='true');
  });
});
test('Solo texto carga estudio sin consultar la biblioteca de imágenes',async()=>{
  const solicitudes=[];const contenidos=crearServicioContenidos({baseURL:new URL('../datos/',import.meta.url),fetcher:(u,o)=>{solicitudes.push(String(u));return fetch(u,o);}});
  await conMotor(async({root,motor})=>{
    assert(solicitudes.length===2&&solicitudes.every(u=>u.includes('/estudios/')));
    assert(root.querySelectorAll('.mv-contexto').length===2);
    await motor.cambiarEnfoque('devocional');assert(solicitudes.length===2&&root.querySelectorAll('.mv-devocional').length===2);
    assert(!root.querySelector('img,.mv-recurso,.mv-portada'));
  },{contenidos});
});
test('El modal conserva Cerrar recurso y no ofrece pantalla completa en ambos enfoques',async()=>{
  await conMotor(async({root,motor})=>{
    for(const enfoque of ['estudio','devocional']){
      await motor.cambiarEnfoque(enfoque);const abrir=root.querySelector('[data-recurso-acceso]');abrir.focus();abrir.click();
      await esperar(()=>root.querySelector('dialog .mv-visor'));const d=root.querySelector('dialog'),visor=d.querySelector('.mv-visor');
      assert(!d.querySelector('.mv-abrir-completa') && d.querySelector('.mv-visor')===visor);
      assert(d.querySelector('button').textContent==='Cerrar recurso');
      assert(motor.obtenerEstado().enfoque===enfoque&&motor.obtenerEstado().modo==='texto');
      d.querySelector('button').click();await frame();assert(!root.querySelector('dialog')&&document.activeElement===abrir);
    }
  });
});
test('El servicio textual rechaza estudios de otro relato o no sintéticos compatibles',async()=>{
  const d=await datos(),r=d.catalogo.relatos[0],valido=(await d.contenidos.cargarVisuales(r)).estudio;
  for(const cambio of [{relatoId:'otro'},{demostracion:false},{id:'otro'}]){
    const servicio=crearServicioContenidos({baseURL:new URL('../datos/',import.meta.url),fetcher:async()=>({ok:true,json:async()=>({...valido,...cambio})})});
    await rechaza(()=>servicio.cargarEstudio(r));
  }
  assert(composicionLectura('devocional','visual').intercalados===false);
  await rechaza(()=>composicionLectura('otro','visual'));
});
