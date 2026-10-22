import { ajustarZoom } from './harness.js';
import { test,assert,conMotor,frame,esperar } from './harness.js';
test('Los visores son 3:4 y las imágenes de portada 16:9', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); await frame();
    const v=root.querySelector('.mv-viewport').getBoundingClientRect(),p=root.querySelector('.mv-portada img').getBoundingClientRect();
    assert(Math.abs(v.width/v.height-.75)<.01); assert(Math.abs(p.width/p.height-16/9)<.01);
  });
});
test('El zoom respeta límites y los marcadores se mantienen sobre la imagen', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); await frame();
    const rango=root.querySelector('[data-zoom]'); ajustarZoom(rango,400); await frame();
    const plano=root.querySelector('.mv-plano').getBoundingClientRect(),m=root.querySelector('[data-marcador="punto-a"]').getBoundingClientRect();
    assert(Math.abs((m.x+m.width/2-plano.x)/plano.width-.25)<.01);
    assert(Math.abs((m.y+m.height/2-plano.y)/plano.height-.5)<.01);
    root.querySelector('button[aria-label="Aumentar zoom"]').click(); assert(rango.dataset.zoom==='400');
    root.querySelector('[aria-label="Restablecer"]').click(); assert(rango.dataset.zoom==='100');
  });
});
test('Los marcadores actualizan su panel informativo', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); root.querySelector('[data-marcador="punto-b"]').click();
    assert(root.querySelector('.mv-panel h4').textContent==='Punto B');
  });
});
test('El visor modal devuelve el foco al disparador', async () => {
  await conMotor(async ({ root,motor }) => {
    const abrir=root.querySelector('[data-recurso-acceso]'); abrir.focus(); abrir.click();
    await esperar(()=>root.querySelector('dialog .mv-visor'));
    const dialogo=root.querySelector('dialog'); assert(dialogo.open); dialogo.close();
    await new Promise(r => setTimeout(r,30)); assert(document.activeElement===abrir);
  });
});
test('La lectura horizontal admite teclado, texto extenso y cambio de sección', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual'); const hoja=root.querySelector('.mv-cierre .mv-hoja');
    hoja.dispatchEvent(new KeyboardEvent('keydown',{ key:'ArrowRight',bubbles:true }));
    assert(root.querySelector('.mv-cierre output').textContent.startsWith('2 / '));
    assert(hoja.textContent.length>1500); assert(hoja.scrollHeight>=hoja.clientHeight);
    const siguiente=root.querySelector('.mv-cierre nav button:last-child');
    const [actual,total]=root.querySelector('.mv-cierre output').textContent.split('/').map(Number);
    assert(siguiente.disabled===(actual===total));
    [...root.querySelectorAll('.mv-cierre .mv-pestanas button')].find(b => b.textContent==='Enseñanzas').click();
    assert(root.querySelector('.mv-cierre output').textContent.startsWith('1 / '));
  });
});
test('El cierre tardío del modal no roba el foco a la lectura', async () => {
  await conMotor(async ({ root,motor }) => {
    root.querySelector('[data-recurso-acceso]').click();
    await esperar(()=>root.querySelector('dialog .mv-visor'));
    root.querySelector('dialog').close(); const hoja=root.querySelector('.mv-texto > p'); hoja.tabIndex=0; hoja.focus();
    await new Promise(r => setTimeout(r,40)); assert(document.activeElement===hoja);
  });
});
test('Un error de imagen tiene alternativa y conserva la lectura', async () => {
  await conMotor(async ({ root,motor }) => {
    await motor.cambiarModo('visual');
    root.querySelector('.mv-portada img').dispatchEvent(new Event('error'));
    root.querySelector('.mv-plano img').dispatchEvent(new Event('error'));
    assert(root.textContent.includes('Portada no disponible'));
    assert(root.textContent.includes('Imagen no disponible'));
    assert(root.querySelectorAll('[data-versiculo]').length===4);
  });
});
test('Los nombres y puntos sincronizan selección y conservan páginas independientes', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual');
    const recurso=root.querySelector('.mv-recurso');
    recurso.querySelector('[data-elemento="punto-b"]').click();
    assert(recurso.querySelector('[data-marcador="punto-b"]').getAttribute('aria-pressed')==='true');
    recurso.querySelector('.mv-panel nav button:last-child').click();
    assert(recurso.querySelector('.mv-panel output').textContent.startsWith('2 / '));
    assert(recurso.querySelector('[data-elemento="punto-b"]').getAttribute('aria-pressed')==='true');
    recurso.querySelector('[data-marcador="punto-a"]').click();
    assert(recurso.querySelector('[data-elemento="punto-a"]').getAttribute('aria-pressed')==='true');
    assert(recurso.querySelector('.mv-panel output').textContent.startsWith('1 / '));
    recurso.querySelector('[data-elemento="punto-b"]').click();
    assert(recurso.querySelector('.mv-panel output').textContent.startsWith('2 / '));
    assert(root.querySelector('.mv-cierre output').textContent.startsWith('1 / '));
  });
});
test('Ocultar puntos deja solo imagen y controles y recupera selección y página', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual');
    const r=root.querySelector('.mv-recurso'), img=r.querySelector('img');
    r.querySelector('[data-elemento="punto-b"]').click();
    r.querySelector('.mv-panel nav button:last-child').click();
    const control=r.querySelector('[data-control="puntos"]'); control.click();
    assert([...r.querySelectorAll('[data-marcador]')].every(b=>b.hidden));
    assert(r.querySelector('.mv-elementos').hidden);
    assert(r.querySelector('.mv-panel').hidden);
    assert(r.querySelector('img')===img && img.isConnected);
    await motor.cambiarEnfoque('devocional');
    assert(control.getAttribute('aria-label')==='Mostrar puntos');
    control.click();
    assert(r.querySelector('[data-elemento="punto-b"]').getAttribute('aria-pressed')==='true');
    assert(r.querySelector('.mv-panel output').textContent.startsWith('2 / '));
  });
});
test('El gesto horizontal pagina el marcador, el vertical no cambia página ni se cancela', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual'); root.querySelector('[data-elemento="punto-a"]').click();
    const hoja=root.querySelector('.mv-panel .mv-hoja');
    function gesto(x,y) {
      hoja.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',isPrimary:true,clientX:200,clientY:100,bubbles:true}));
      const e=new PointerEvent('pointerup',{pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true});
      hoja.dispatchEvent(e); assert(!e.defaultPrevented);
    }
    gesto(190,250); assert(root.querySelector('.mv-panel output').textContent.startsWith('1 / '));
    gesto(80,105); assert(root.querySelector('.mv-panel output').textContent.startsWith('2 / '));
    assert(root.querySelector('[data-marcador="punto-a"]').getAttribute('aria-pressed')==='true');
    hoja.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
    assert(root.querySelector('.mv-panel output').textContent.startsWith('1 / '));
  });
});
test('La imagen 2:3 queda completa en el marco 3:4 y mantiene coordenadas al desplazar zoom', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual'); await frame();
    const v=root.querySelector('.mv-viewport'),p=root.querySelector('.mv-plano');
    const marco=v.getBoundingClientRect(),plano=p.getBoundingClientRect();
    assert(Math.abs(plano.width/plano.height-2/3)<.01);
    assert(plano.width<=marco.width+1 && plano.height<=marco.height+1);
    assert(plano.left>=marco.left-1 && plano.top>=marco.top-1);
    const rango=root.querySelector('[data-zoom]'); ajustarZoom(rango,300);
    v.scrollTo(80,120); await frame();
    const q=p.getBoundingClientRect(),b=root.querySelector('[data-marcador="punto-b"]').getBoundingClientRect();
    assert(Math.abs((b.x+b.width/2-q.x)/q.width-.75)<.01);
    assert(Math.abs((b.y+b.height/2-q.y)/q.height-.5)<.01);
    root.querySelector('[aria-label="Restablecer"]').click();
    assert(v.scrollLeft===0 && v.scrollTop===0 && rango.dataset.zoom==='100');
  });
});
test('Los paneles heredados de una página y recursos sin puntos siguen siendo compatibles', async () => {
  const {crearExplorador}=await import('../js/componentes/explorador.js');
  const abort=new AbortController(),root=document.createElement('div'); root.className='mv';document.body.append(root);
  const recurso={src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',alt:'DEMO',leyenda:'DEMO: descripción general',dimensiones:{ancho:1600,alto:900}};
  try {
    const el=crearExplorador(recurso,{id:'anterior',marcadores:[{id:'viejo',x:.5,y:.5,titulo:'Anterior',parrafos:['DEMO heredada.'],certezaHistorica:'Demostración.'}]},{signal:abort.signal});
    root.append(el);el.querySelector('[data-elemento]').click();
    assert(el.querySelector('.mv-panel p').textContent==='DEMO heredada.');
    assert(el.querySelector('.mv-panel nav').hidden);
    const sinPuntos=crearExplorador(recurso,{id:'limpio',marcadores:[]},{signal:abort.signal}); root.append(sinPuntos);
    assert(!sinPuntos.querySelector('[data-control="puntos"]'));
    assert(sinPuntos.querySelector('.mv-panel').hidden && sinPuntos.querySelector('.mv-ficha-recurso p').textContent===recurso.leyenda);
  } finally {abort.abort();root.remove();}
});

test('El explorador selecciona el primer elemento sin duplicar su explicación ni la descripción general', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual'); await frame();
    for(const r of root.querySelectorAll('.mv-recurso')) {
      const primero=r.querySelector('[data-elemento]');
      if(!primero) { assert(r.querySelector('.mv-panel').hidden); continue; }
      assert(primero.getAttribute('aria-pressed')==='true');
      assert(r.querySelectorAll('[data-marcador][aria-pressed="true"]').length===1);
      assert(r.querySelector('.mv-panel h4').textContent===primero.textContent);
      assert(r.querySelectorAll('.mv-panel .mv-estudio').length===1);
      assert(!r.querySelector('.mv-ficha-recurso').open && !r.querySelector('.mv-visor small'));
    }
  });
});
test('La barra contiene solo cuatro botones accesibles y el porcentaje, sin controles futuros ni deslizador', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual'); await frame();
    const barra=root.querySelector('.mv-herramientas');
    assert(barra.children.length===5 && barra.querySelectorAll('button').length===4 && !barra.querySelector('input'));
    assert([...barra.querySelectorAll('button')].every(b=>b.getAttribute('aria-label')));
    assert(barra.querySelector('output').dataset.zoom==='100');
    assert(barra.querySelector('[aria-label="Reducir zoom"]').disabled);
    assert(barra.querySelector('[data-control="puntos"]').getAttribute('aria-pressed')==='true');
  });
});
test('La ficha conserva las advertencias y al ocultar no se monta una descripción de reemplazo', async () => {
  await conMotor(async ({root,motor}) => {
    await motor.cambiarModo('visual'); await frame();
    const r=root.querySelector('.mv-recurso'),panel=r.querySelector('.mv-panel'),estudio=panel.firstChild;
    const info=r.querySelector('.mv-ficha-recurso'); info.open=true;
    assert(info.querySelector('p').textContent.length>0); info.open=false;
    r.querySelector('[data-control="puntos"]').click();
    assert(panel.hidden && panel.firstChild===estudio && r.querySelector('img'));
    r.querySelector('[data-control="puntos"]').click();
    assert(!panel.hidden && r.querySelectorAll('.mv-panel .mv-estudio').length===1);
  });
});
