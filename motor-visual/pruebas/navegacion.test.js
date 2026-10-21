import { test,assert,datos,conMotor,rechaza } from './harness.js';
import { vecinos,leerRuta } from '../js/estado/navegacion.js';
test('Los extremos del catálogo y los capítulos tienen límites independientes', async () => {
  const { catalogo }=await datos(); const primero=vecinos(catalogo,'demo-uno'),ultimo=vecinos(catalogo,'demo-tres');
  assert(!primero.anterior && primero.siguiente.id==='demo-dos');
  assert(!primero.capituloAnterior && primero.capituloSiguiente.id==='demo-tres');
  assert(!ultimo.siguiente && ultimo.capituloAnterior.id==='demo-uno');
});
test('Los enlaces directos válidos se interpretan y los inválidos usan Solo texto', async () => {
  const { catalogo }=await datos(); const valido=leerRuta('?relato=demo-dos&modo=visual',catalogo);
  assert(valido.relatoId==='demo-dos' && valido.modo==='visual');
  const invalido=leerRuta('?relato=no-existe&modo=otro',catalogo);
  assert(invalido.relatoId==='demo-uno' && invalido.modo==='texto');
});
test('La navegación por botones cambia el relato sin duplicar el lector', async () => {
  await conMotor(async ({ root,motor }) => {
    const siguiente=root.querySelector('[data-relato-indice="demo-dos"]');
    siguiente.focus(); siguiente.click();
    await new Promise(r => setTimeout(r,30));
    assert(motor.obtenerEstado().relatoId==='demo-dos'); assert(root.querySelectorAll('.mv-texto').length===1);
    assert(document.activeElement===root.querySelector('.mv-titulo-relato'), 'El foco debe continuar en el relato nuevo');
  });
});
test('No se puede seleccionar un relato inexistente', async () => {
  await conMotor(async ({ motor }) => { await rechaza(() => motor.seleccionar('inexistente')); assert(motor.obtenerEstado().relatoId==='demo-uno'); });
});

test('El índice reemplaza los botones redundantes y no monta descubrimiento', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual');
    assert(root.querySelectorAll('.mv-navegacion button').length===2);
    assert(!root.querySelector('[aria-label^="Relato anterior"],[aria-label^="Relato siguiente"],.mv-descubrimiento'));
    assert(root.querySelector('[aria-label^="Capítulo siguiente:"]'));
    assert(root.querySelectorAll('.mv-indice button').length===2);
  });
});
test('La carga tardía de un relato anterior no roba el foco ni desplaza el nuevo destino', async () => {
  const d=await datos(); let resolver;
  const espera=new Promise(r=>{resolver=r;});
  const biblia={obtenerPasaje:r=>r.rangos[0].desde===3 ? espera : d.biblia.obtenerPasaje(r)};
  await conMotor(async ({root,motor}) => {
    const anterior=motor.seleccionar('demo-dos');
    await motor.seleccionar('demo-tres');
    const destino=root.querySelector('.mv-titulo-relato');
    assert(document.activeElement===destino);
    const posicion=scrollY;
    resolver(await d.biblia.obtenerPasaje(d.catalogo.relatos[1].referencia));
    await anterior;
    assert(root.querySelector('.mv-titulo-relato')===destino && document.activeElement===destino);
    assert(scrollY===posicion,'Una respuesta descartada no debe alterar el desplazamiento');
  },{biblia});
});

test('Volver al relato activo desde el índice conserva el visor, su zoom y su marcador', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual');
    const visor=root.querySelector('.mv-visor'),rango=visor.querySelector('input[type="range"]');
    rango.value='250';rango.dispatchEvent(new Event('input'));
    root.querySelector('[data-elemento="punto-b"]').click();
    root.querySelector('.mv-panel nav button:last-child').click();
    root.querySelector('.mv-indice [aria-current="true"]').click();
    assert(root.querySelector('.mv-visor')===visor && rango.value==='250');
    assert(root.querySelector('.mv-panel output').textContent==='2 / 2');
    assert(root.querySelector('[data-marcador="punto-b"]').getAttribute('aria-pressed')==='true');
    assert(document.activeElement===root.querySelector('.mv-titulo-relato'));
  });
});
