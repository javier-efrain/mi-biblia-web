import { nodo, boton } from './dom.js';
export function crearSelectorEnfoque(enfoque, cambiar) {
  return nodo('div', { className:'mv-enfoques', role:'group', 'aria-label':'Enfoque educativo' },
    ...[['estudio','Estudio'],['devocional','Devocional']].map(([valor,titulo]) =>
      boton(titulo, () => cambiar(valor), { 'aria-pressed':String(enfoque === valor), 'data-enfoque':valor })));
}

// Política editorial central: futuro punto de resolución de metadatos por relato.
// Por ahora solo existen estas reglas generales, sin excepciones implícitas.
const enfoques = Object.freeze({
  estudio:Object.freeze({contexto:['contexto'],cierre:['exegesis','ensenanzas','aplicacion'],recursos:true}),
  devocional:Object.freeze({contexto:[],cierre:['devocional'],recursos:false})
});
export function composicionLectura(enfoque,modo) {
  const plan=enfoques[enfoque];
  if(!plan||!['visual','texto'].includes(modo))throw new Error('Composición inválida.');
  return {...plan,portada:modo==='visual',intercalados:modo==='visual'&&plan.recursos,
    accesos:modo==='texto',pantallaCompletaIntegrada:false,pantallaCompletaModal:true};
}
