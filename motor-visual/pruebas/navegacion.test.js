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
    const siguiente=root.querySelector('button[aria-label^="Relato siguiente:"]');
    siguiente.focus(); siguiente.click();
    await new Promise(r => setTimeout(r,30));
    assert(motor.obtenerEstado().relatoId==='demo-dos'); assert(root.querySelectorAll('.mv-texto').length===1);
    assert(document.activeElement===root.querySelector('h2'), 'El foco debe continuar en el relato nuevo');
  });
});
test('No se puede seleccionar un relato inexistente', async () => {
  await conMotor(async ({ motor }) => { await rechaza(() => motor.seleccionar('inexistente')); assert(motor.obtenerEstado().relatoId==='demo-uno'); });
});
