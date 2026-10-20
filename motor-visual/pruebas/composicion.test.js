import { test,assert,conMotor,datos,rechaza,diferida } from './harness.js';
import { leerRuta } from '../js/estado/navegacion.js';
const despues = (a,b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const avanzar = hoja => hoja.dispatchEvent(new KeyboardEvent('keydown',{ key:'ArrowRight',bubbles:true }));

test('La composición ordena cabecera, capítulo, título, referencia, portada, contexto, lectura y cierre', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    const selectores=['.mv-barra-lector','.mv-capitulo','.mv-titulo-relato','.mv-relato > .mv-referencia','.mv-relato .mv-portada','.mv-contexto','.mv-texto','.mv-cierre'];
    const partes=selectores.map(s => root.querySelector(s));
    assert(partes.every(Boolean)); assert(partes.slice(1).every((p,i) => despues(partes[i],p)));
    assert(root.querySelectorAll('.mv-barra-lector [data-enfoque]').length===2);
    assert(root.querySelectorAll('.mv-barra-lector [data-modo]').length===2);
    assert(root.querySelector('.mv-libro').textContent.includes('Demostración'));
  });
});
test('La portada mantiene el pie accesible sin repetir visualmente el título', async () => {
  await conMotor(async ({ root,motor,contenidos,catalogo }) => {
    await motor.cambiarModo('visual');
    const figura=root.querySelector('.mv-relato .mv-portada');
    assert(figura.querySelector('figcaption').classList.contains('mv-solo-lectores'));
    const datos=await contenidos.cargarVisuales(catalogo.relatos[0]);
    const portada=datos.recursos.find(r => r.id===catalogo.relatos[0].portadaId);
    assert(!/<text\b/i.test(await (await fetch(portada.src)).text()),'La portada sintética no debe tener letras dibujadas');
  });
});
test('El índice horizontal muestra solo los relatos del capítulo y señala el activo', async () => {
  await conMotor(async ({ root,motor }) => {
    assert(root.querySelectorAll('.mv-indice button').length===2);
    await motor.seleccionar('demo-dos');
    assert(root.querySelector('.mv-indice [aria-current="true"]').dataset.relatoIndice==='demo-dos');
    await motor.seleccionar('demo-tres');
    assert(root.querySelectorAll('.mv-indice button').length===1);
    assert(root.querySelector('.mv-capitulo h1').textContent==='Capítulo 2');
  });
});
test('Contexto y cierre mantienen páginas independientes', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    avanzar(root.querySelector('.mv-contexto .mv-hoja'));
    assert(root.querySelector('.mv-contexto output').textContent==='2 / 2');
    assert(root.querySelector('.mv-cierre output').textContent==='1 / 2');
    avanzar(root.querySelector('.mv-cierre .mv-hoja'));
    assert(root.querySelector('.mv-contexto output').textContent==='2 / 2');
    assert(root.querySelector('.mv-cierre output').textContent==='2 / 2');
  });
});
test('Devocional sustituye contexto y estudio sin reconstruir el visor ni perder su zoom', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    const visor=root.querySelector('.mv-visor'),texto=root.querySelector('.mv-texto'),rango=root.querySelector('input[type="range"]');
    rango.value='250'; rango.dispatchEvent(new Event('input'));
    root.querySelector('[data-marcador="punto-b"]').click();
    avanzar(root.querySelector('.mv-contexto .mv-hoja'));
    avanzar(root.querySelector('.mv-cierre .mv-hoja'));
    await motor.cambiarEnfoque('devocional');
    assert(!root.querySelector('.mv-contexto'));
    assert(root.querySelector('.mv-devocional') && !root.querySelector('.mv-pestanas'));
    assert(root.querySelector('.mv-visor')===visor && root.querySelector('.mv-texto')===texto);
    assert(rango.value==='250' && root.querySelector('.mv-panel h4').textContent==='Punto B');
    avanzar(root.querySelector('.mv-cierre .mv-hoja'));
    await motor.cambiarEnfoque('estudio');
    assert(root.querySelector('.mv-contexto output').textContent==='2 / 2');
    assert(root.querySelector('.mv-cierre output').textContent==='2 / 2');
    await motor.cambiarEnfoque('devocional');
    assert(root.querySelector('.mv-cierre output').textContent==='2 / 2');
  });
});
test('Solo texto conserva ambos selectores sin solicitar contenido educativo en ningún enfoque', async () => {
  let llamadas=0;
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarEnfoque('devocional');
    await motor.seleccionar('demo-dos');
    await motor.cambiarEnfoque('estudio');
    assert(llamadas===0 && !root.querySelector('img,[data-educativo],dialog'));
    assert(root.querySelectorAll('[data-enfoque]').length===2 && root.querySelectorAll('[data-modo]').length===2);
  },{ contenidos:{ cargarVisuales:async () => { llamadas++; } } });
});
test('Un enfoque elegido durante la carga visual se aplica al terminar sin montar el contexto', async () => {
  const d=await datos(),espera=diferida(); let comenzo=false;
  await conMotor(async ({ root,motor }) => {
    const carga=motor.cambiarModo('visual');
    for(let i=0;i<30 && !comenzo;i++) await new Promise(r=>setTimeout(r,5));
    assert(comenzo); await motor.cambiarEnfoque('devocional');
    espera.resolver(await d.contenidos.cargarVisuales(d.catalogo.relatos[0])); await carga;
    assert(!root.querySelector('.mv-contexto') && root.querySelector('.mv-devocional'));
  },{ contenidos:{ cargarVisuales:() => { comenzo=true;return espera.promesa; } } });
});
test('Los enlaces antiguos mantienen Estudio como enfoque y los nuevos aceptan Devocional', async () => {
  const { catalogo }=await datos();
  assert(leerRuta('?relato=demo-dos&modo=visual',catalogo).enfoque==='estudio');
  assert(leerRuta('?relato=demo-dos&modo=visual&enfoque=devocional',catalogo).enfoque==='devocional');
  assert(leerRuta('?enfoque=invalido',catalogo).enfoque==='estudio');
});
test('Los ejemplos con Aplicación conservan su cierre y no necesitan otro HTML', async () => {
  const d=await datos(),cargarVisuales=async (r,op) => {
    const datos=structuredClone(await d.contenidos.cargarVisuales(r,op));
    datos.estudio.secciones.find(s=>s.tipo==='ensenanzas').tipo='aplicacion';
    datos.estudio.secciones.find(s=>s.tipo==='aplicacion').titulo='Aplicación';
    return datos;
  };
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    assert([...root.querySelectorAll('.mv-cierre .mv-pestanas button')].some(b=>b.textContent==='Aplicación'));
    await rechaza(()=>motor.cambiarEnfoque('otro'));
  },{ contenidos:{ cargarVisuales } });
});
