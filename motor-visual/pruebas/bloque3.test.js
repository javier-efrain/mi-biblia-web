import { ajustarZoom } from './harness.js';
import {test,assert,conMotor,frame,esperar,datos} from './harness.js';
import {relatosDelCapitulo} from '../js/estado/navegacion.js';

test('El capítulo monta todos sus relatos, versículos ordenados y una sola cabecera',async()=>{
  await conMotor(async({root,motor})=>{
    for(const modo of ['texto','visual']){
      await motor.cambiarModo(modo);
      assert([...root.querySelectorAll('[data-relato-contenido]')].map(e=>e.dataset.relatoContenido).join(',')==='demo-uno,demo-dos');
      assert([...root.querySelectorAll('[data-versiculo]')].map(e=>e.dataset.versiculo).join(',')==='contenido-sintetico:1:1,contenido-sintetico:1:2,contenido-sintetico:1:3,contenido-sintetico:1:4');
      assert(root.querySelectorAll('.mv-barra-lector').length===1 && root.querySelectorAll('.mv-indice').length===1);
      assert([...root.querySelectorAll('.mv-indice button')].every(b=>b.querySelector('small').textContent.includes('Referencia sintética')));
      if(modo==='texto')assert(!root.querySelector('img,.mv-recurso'));
      else assert(root.querySelectorAll('.mv-contexto').length===2 && root.querySelectorAll('.mv-cierre').length===2);
    }
  });
});
test('El índice cambia el destino y conserva todos los nodos, zoom y páginas del capítulo',async()=>{
  await conMotor(async({root,motor})=>{
    await motor.cambiarModo('visual');
    const articulos=[...root.querySelectorAll('.mv-relato')],v=root.querySelector('.mv-visor'),r=v.querySelector('[data-zoom]');
    ajustarZoom(r,250);
    root.querySelector('[data-elemento="punto-b"]').click();root.querySelector('.mv-panel nav button:last-child').click();
    await motor.seleccionar('demo-dos');await motor.seleccionar('demo-uno');
    assert(articulos.every((e,i)=>root.querySelectorAll('.mv-relato')[i]===e));
    assert(root.querySelector('.mv-visor')===v && r.dataset.zoom==='250');
    assert(root.querySelector('.mv-panel output').textContent.startsWith('2 / '));
    assert(root.querySelector('[data-relato-indice="demo-uno"]').getAttribute('aria-current')==='true');
  });
});
test('El orden del capítulo sigue los versículos aunque el catálogo llegue invertido',async()=>{
  const {catalogo}=await datos();catalogo.relatos.reverse();
  assert(relatosDelCapitulo(catalogo,'demo-dos').map(r=>r.id).join(',')==='demo-uno,demo-dos');
});
test('El modal sin pantalla completa conserva visor, zoom, selección y cierre',async()=>{
  await conMotor(async({root})=>{
    const acceso=root.querySelector('[data-recurso-acceso]');acceso.focus();acceso.click();
    await esperar(()=>root.querySelector('dialog .mv-visor'));await frame();
    const modal=root.querySelector('dialog'),e=modal.querySelector('.mv-recurso'),v=e.querySelector('.mv-visor'),r=e.querySelector('[data-zoom]');
    ajustarZoom(r,200);e.querySelector('[data-elemento="punto-b"]').click();
    assert(!e.querySelector('.mv-abrir-completa') && !modal.classList.contains('mv-completa'));
    assert(modal.querySelector('.mv-visor')===v && r.dataset.zoom==='200');
    assert(e.querySelector('[data-marcador="punto-b"]').getAttribute('aria-pressed')==='true');
    assert(modal.querySelector('button').textContent==='Cerrar recurso');
    assert(Math.abs(v.querySelector('.mv-viewport').clientWidth/v.querySelector('.mv-viewport').clientHeight-.75)<.01);
    modal.querySelector('button').click();await frame();assert(!root.querySelector('dialog')&&document.activeElement===acceso);
  });
});
test('Los visores cambian la acción táctil según el zoom y la restauran al 100 %',async()=>{
  await conMotor(async({root,motor})=>{
    await motor.cambiarModo('visual');await frame();
    const v=root.querySelector('.mv-viewport'),r=root.querySelector('.mv-visor [data-zoom]');
    assert(v.style.touchAction==='pan-y');ajustarZoom(r,200);
    assert(v.style.touchAction==='none');ajustarZoom(r,100);assert(v.style.touchAction==='pan-y');
  });
});
test('Solo texto ofrece un botón reconocible y reutiliza el mismo explorador bajo demanda',async()=>{
  await conMotor(async({root})=>{
    const boton=root.querySelector('[data-recurso-acceso]');assert(boton.textContent.includes('Ver recurso visual') && boton.getAttribute('aria-label').includes('Ver recurso visual'));
    boton.focus();boton.click();await esperar(()=>root.querySelector('dialog .mv-visor'));
    assert(root.querySelectorAll('dialog .mv-recurso').length===1);
    assert(root.querySelector('.mv-contexto,.mv-cierre')&&!root.querySelector('.mv-portada'));
    root.querySelector('dialog').close();await frame();assert(document.activeElement===boton && !root.querySelector('img'));
  });
});
test('Cambiar de modo con el modal abierto cancela y desmonta todos los recursos',async()=>{
  await conMotor(async({root,motor})=>{
    root.querySelector('[data-recurso-acceso]').click();await esperar(()=>root.querySelector('dialog .mv-visor'));
    assert(root.querySelector('dialog[open]'));await motor.cambiarModo('visual');await motor.cambiarModo('texto');
    assert(!root.querySelector('dialog,img,.mv-recurso')&&!document.body.classList.contains('mv-modal-abierto'));
    assert(root.querySelectorAll('.mv-relato').length===2);
  });
});
