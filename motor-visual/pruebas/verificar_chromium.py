"""Verificación local reproducible. Requiere Python, playwright y jsonschema.
No instala paquetes ni consulta Internet. Sirve solo en 127.0.0.1 y apaga el servidor.
Ejecutar: python motor-visual/pruebas/verificar_chromium.py
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from jsonschema import Draft202012Validator
from playwright.sync_api import sync_playwright, expect

MOTOR = Path(__file__).resolve().parents[1]
REPO = MOTOR.parent
SALIDA = MOTOR / 'pruebas'


def originales():
    nombres = subprocess.check_output(['git', 'ls-files', '-z'], cwd=REPO).decode().split('\0')
    return {n: hashlib.sha256((REPO / n).read_bytes()).hexdigest()
            for n in nombres if n and not n.startswith('motor-visual/')}


def validar_esquemas():
    catalogo = json.loads((MOTOR / 'datos/catalogo.json').read_text())
    recursos = json.loads((MOTOR / 'datos/recursos.json').read_text())
    total = 0
    for tipo, documentos in [
        ('relato', catalogo['relatos']),
        ('estudio', [json.loads(p.read_text()) for p in sorted((MOTOR / 'datos/estudios').glob('*.json'))]),
        ('recurso', recursos['recursos']),
    ]:
        schema = json.loads((MOTOR / f'contratos/{tipo}.schema.json').read_text())
        Draft202012Validator.check_schema(schema)
        validador = Draft202012Validator(schema)
        for documento in documentos:
            validador.validate(documento)
            total += 1
    return total


class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def capturar(pagina, ruta):
    # Fijar el origen antes de capturar una página completa con cabecera sticky.
    pagina.evaluate('window.scrollTo(0,0)')
    pagina.wait_for_function('window.scrollY === 0')
    pagina.screenshot(path=str(ruta),full_page=True,animations="disabled")


def probar_demo(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    pagina = contexto.new_page()
    solicitudes, errores = [], []
    pagina.on('request', lambda r: solicitudes.append(r.url))
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    checks = []

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}: {descripcion}')
        checks.append(descripcion)

    pagina.goto(origen + '/motor-visual/demo.html?relato=demo-dos&modo=texto')
    pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('#motor [data-versiculo]').count() == 2, 'Enlace directo a segundo relato')
    comprobar(pagina.locator('#motor img, #motor [data-educativo], #motor dialog').count() == 0,
              'Solo texto sin DOM educativo o visual')
    comprobar(not any('/datos/estudios/' in u or u.endswith('/datos/recursos.json') or u.endswith('.svg')
                      for u in solicitudes), 'Solo texto sin solicitudes de estudios, biblioteca ni imágenes')
    comprobar(not any('/componentes/' in u and any(x in u for x in
                      ['visor.js', 'explorador.js', 'portada.js', 'lectura-horizontal.js', 'descubrimiento.js'])
                      for u in solicitudes), 'Solo texto sin descargar módulos visuales')
    comprobar(not any('/biblia/' in u or '/rvc/' in u for u in solicitudes), 'Sin solicitudes al lector o archivos RVC')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal inicial')
    capturas = SALIDA / 'capturas'
    capturas.mkdir(exist_ok=True)
    capturar(pagina,capturas / f'{nombre}-texto.png')

    pagina.get_by_role('button', name='Con recursos visuales', exact=True).click()
    pagina.wait_for_selector('.mv-cierre')
    comprobar(pagina.locator('#motor .mv-recurso').count() == 2, 'Dos recursos en dos anclajes del segundo relato')
    comprobar(pagina.locator('.mv-tarjeta').count() == 3, 'Catálogo de tres relatos con metadatos')
    medidas = pagina.locator('.mv-viewport').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(medidas['w'] / medidas['h'] - .75) < .01, 'Visor 3:4')
    portada = pagina.locator('.mv-portada img').first.evaluate('(e) => ({ w:e.clientWidth, h:e.clientHeight })')
    comprobar(abs(portada['w'] / portada['h'] - 16 / 9) < .01, 'Portada 16:9')
    comprobar(pagina.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Sin desbordamiento horizontal visual')
    capturar(pagina,capturas / f'{nombre}-visual.png')

    slider = pagina.locator('input[type=range]').first
    slider.fill('250')
    slider.dispatch_event('input')
    viewport = pagina.locator('.mv-viewport').first
    viewport.evaluate('(e) => { e.scrollLeft=100; e.scrollTop=100; }')
    comprobar(viewport.evaluate('(e) => e.scrollLeft > 0 && e.scrollTop > 0'), 'Zoom y desplazamiento en ambos ejes')
    pagina.set_viewport_size({'width': 430 if nombre == 'movil' else 1100, 'height': 932 if nombre == 'movil' else 850})
    pagina.wait_for_timeout(100)
    alineado = pagina.locator('.mv-recurso').first.evaluate('''e => {
      const p=e.querySelector('.mv-plano').getBoundingClientRect();
      const m=e.querySelector('[data-marcador="punto-a"]').getBoundingClientRect();
      return Math.abs((m.x+m.width/2-p.x)/p.width-.25)<.01 && Math.abs((m.y+m.height/2-p.y)/p.height-.5)<.01;
    }''')
    comprobar(alineado, 'Marcadores alineados tras zoom, scroll y redimensionamiento')
    # Playwright desplaza el visor para alcanzar el marcador ampliado.
    pagina.locator('[data-marcador="punto-b"]').first.click()
    expect(pagina.locator('.mv-panel h4').first).to_have_text('Punto B')
    checks.append('Panel informativo del marcador')

    abrir = pagina.get_by_role('button', name='Ampliar visor', exact=True).first
    abrir.click()
    dialogo = pagina.locator('dialog[open]')
    expect(dialogo).to_be_visible()
    pagina.keyboard.press('Tab')
    foco_dentro = pagina.evaluate('document.querySelector("dialog[open]").contains(document.activeElement)')
    comprobar(foco_dentro, 'Foco dentro del diálogo modal')
    pagina.keyboard.press('Escape')
    expect(pagina.locator('dialog[open]')).to_have_count(0)
    expect(abrir).to_be_focused()
    checks.append('Escape cierra el visor y devuelve el foco')

    hoja = pagina.locator('.mv-cierre .mv-hoja')
    hoja.focus()
    pagina.keyboard.press('ArrowRight')
    expect(pagina.locator('.mv-cierre output')).to_have_text('2 / 2')
    comprobar(len(hoja.inner_text()) > 1500, 'Lectura extensa por teclado sin truncamiento')
    if nombre == 'movil':
        pagina.get_by_role('button', name='Enseñanzas', exact=True).click()
        hoja.dispatch_event('pointerdown', {'pointerType':'touch', 'isPrimary':True, 'clientX':250, 'clientY':120})
        hoja.dispatch_event('pointerup', {'pointerType':'touch', 'isPrimary':True, 'clientX':100, 'clientY':125})
        expect(pagina.locator('.mv-cierre output')).to_have_text('2 / 2')
        checks.append('Gesto horizontal simulado cambia de página')

    pagina.get_by_role('button', name='Solo texto bíblico', exact=True).click()
    expect(pagina.locator('#motor [data-educativo], #motor img, #motor dialog')).to_have_count(0)
    pagina.go_back()
    pagina.wait_for_selector('.mv-cierre')
    pagina.go_forward()
    expect(pagina.locator('#motor [data-educativo]')).to_have_count(0)
    checks.append('Atrás y Adelante restauran el modo y desmontan visuales')
    pagina.get_by_role('button', name='Capítulo siguiente:', exact=False).click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-tres')
    checks.append('Navegación a otro capítulo sintético')
    comprobar(not errores, 'Sin errores JavaScript no controlados')
    comprobar(all(urlparse(u).netloc == urlparse(origen).netloc for u in solicitudes), 'Sin solicitudes externas')
    contexto.close()
    return {'comprobaciones':checks,'solicitudes':solicitudes,'errores':errores}



def probar_accesibilidad(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    pagina = contexto.new_page()
    errores, checks = [], []
    pagina.on('pageerror', lambda e: errores.append(str(e)))
    url = origen + '/motor-visual/demo.html?relato=demo-dos&modo=visual'

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}, accesibilidad: {descripcion}')
        checks.append(descripcion)

    def sin_recortes():
        return pagina.evaluate("""() => {
          if (document.documentElement.scrollWidth > innerWidth) return false;
          return [...document.querySelectorAll('.mv-texto > p,.mv-hoja p,.mv-panel p')].every(p => {
            if (!p.getBoundingClientRect().height) return true;
            const c=getComputedStyle(p);
            return p.scrollWidth <= p.clientWidth+1 && p.scrollHeight <= p.clientHeight+1 &&
              c.overflowX !== 'hidden' && c.overflowY !== 'hidden';
          });
        }""")

    pagina.goto(url)
    pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('body').get_attribute('data-apariencia') == 'oscuro', 'Oscuro predeterminado en navegador sin preferencias')
    comprobar(pagina.locator('.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '8px', 'Texto de lectura experimental inicial a 8 px')
    aumentar = pagina.get_by_role('button', name='Aumentar tamaño de letra', exact=True)
    reducir = pagina.get_by_role('button', name='Reducir tamaño de letra', exact=True)
    comprobar(pagina.locator('.mv-preferencias').is_visible(), 'Controles A− y A+ visibles')
    pagina.locator('[data-marcador="punto-b"]').first.click()
    pagina.locator('.mv-cierre .mv-hoja').focus()
    pagina.keyboard.press('ArrowRight')
    expect(pagina.locator('.mv-cierre output')).to_have_text('2 / 2')
    pagina.evaluate('window.__hojaAntes = document.querySelector(".mv-cierre .mv-hoja")')
    for _ in range(11):
        aumentar.focus()
        pagina.keyboard.press('Enter')
    expect(pagina.locator('.mv-preferencias output')).to_have_text('30 px')
    expect(aumentar).to_be_disabled()
    comprobar(pagina.evaluate('window.__hojaAntes === document.querySelector(".mv-cierre .mv-hoja")'), 'Aumentar texto no reconstruye el estudio')
    comprobar(pagina.locator('.mv-cierre output').inner_text() == '2 / 2', 'Se conserva la página de explicación al ampliar')
    for selector in ['.mv-texto > p', '.mv-hoja p', '.mv-panel p']:
        comprobar(pagina.locator(selector).first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', f'Texto a 30 px: {selector}')
    comprobar(sin_recortes(), 'Párrafos extensos a 30 px sin recortes ni scroll horizontal')
    botones = pagina.locator('.mv-preferencias button').evaluate_all('(bs)=>bs.every(b=>b.getBoundingClientRect().width>=44 && b.getBoundingClientRect().height>=44)')
    comprobar(botones, 'Controles de apariencia de al menos 44 × 44 px')
    tema = pagina.get_by_role('button',name='Modo oscuro',exact=True)
    tema.focus()
    foco = tema.evaluate('(b)=>getComputedStyle(b).outlineStyle')
    comprobar(foco != 'none', 'Foco visible al usar teclado')
    tema.press('Space')
    expect(tema).to_have_attribute('aria-pressed','false')
    comprobar(pagina.locator('body').get_attribute('data-apariencia') == 'claro', 'Apariencia clara seleccionable con teclado')
    comprobar(sin_recortes(), 'Modo claro a 30 px sin desbordamiento')
    capturar(pagina,SALIDA / 'capturas' / f'{nombre}-claro-30.png')
    pagina.reload()
    pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('body').get_attribute('data-apariencia') == 'claro', 'Apariencia recuperada al recargar')
    comprobar(pagina.locator('.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Tamaño recuperado al recargar')
    guardado = pagina.evaluate('JSON.parse(localStorage.getItem("mi-biblia-web:motor-visual:preferencias:v1"))')
    comprobar(guardado == {'apariencia':'claro','tamano':30}, 'Se guardan solo apariencia y tamaño')
    for _ in range(11):
        reducir.click()
    expect(reducir).to_be_disabled()
    expect(pagina.locator('.mv-preferencias output')).to_have_text('8 px')
    comprobar(sin_recortes(), 'Tamaño mínimo 8 px sin desbordamiento')
    for _ in range(11):
        aumentar.click()
    tema.click()
    pagina.get_by_role('button',name='Devocional',exact=True).click()
    comprobar(pagina.locator('.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Devocional a 30 px')
    pagina.locator('[data-marcador="punto-b"]').first.click()
    comprobar(pagina.locator('.mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Explicación del mapa a 30 px')
    pagina.locator('input[type=range]').first.fill('250')
    pagina.locator('input[type=range]').first.dispatch_event('input')
    comprobar(pagina.locator('.mv-visor output').first.inner_text() == '250 %', 'El zoom sigue funcionando con texto a 30 px')
    pagina.get_by_role('button', name='Ampliar visor',exact=True).first.click()
    comprobar(pagina.locator('dialog[open] .mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'El panel modal hereda el tamaño de lectura')
    comprobar(pagina.locator('dialog[open]').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1'), 'Modal sin scroll horizontal de párrafos a 30 px')
    pagina.keyboard.press('Escape')
    pagina.wait_for_timeout(50)
    comprobar(sin_recortes(), 'Visuales, panel y devocional sin recortes a 30 px')
    pagina.locator('input[type=range]').first.fill('100')
    pagina.locator('input[type=range]').first.dispatch_event('input')
    capturar(pagina,SALIDA / 'capturas' / f'{nombre}-oscuro-30.png')
    pagina.get_by_role('button',name='Solo texto bíblico',exact=True).click()
    expect(pagina.locator('#motor [data-educativo],#motor img')).to_have_count(0)
    comprobar(pagina.locator('.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Solo texto conserva 30 px sin montar visuales')
    comprobar(pagina.locator('.mv-preferencias').is_visible(), 'Ajustes disponibles en Solo texto')
    pagina.get_by_role('button',name='Relato siguiente:',exact=False).click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-tres')
    comprobar(pagina.locator('.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize') == '30px', 'Navegar conserva tamaño y apariencia')
    if nombre == 'movil':
        pagina.set_viewport_size({'width':320,'height':740})
        comprobar(sin_recortes(), 'Pantalla estrecha de 320 px con lectura a 30 px')
        pagina.get_by_role('button',name='Con recursos visuales',exact=True).click()
        pagina.wait_for_selector('.mv-cierre')
        comprobar(sin_recortes(), 'Visuales a 320 px de ancho y letra a 30 px')
    comprobar(not errores, 'Sin errores JavaScript durante los ajustes')
    contexto.close()
    return {'comprobaciones':checks,'errores':errores}



def probar_compactacion(browser, origen, configuracion, nombre):
    contexto = browser.new_context(**configuracion)
    contexto.add_init_script("""if (!localStorage.getItem('mi-biblia-web:motor-visual:preferencias:v1')) {
      localStorage.setItem('mi-biblia-web:motor-visual:preferencias:v1', JSON.stringify({apariencia:'oscuro',tamano:20}));
    }""")
    pagina = contexto.new_page()
    checks, errores, muestras = [], [], []
    pagina.on('pageerror',lambda e: errores.append(str(e)))

    def comprobar(condicion, descripcion):
        if not condicion:
            raise AssertionError(f'{nombre}, compactación: {descripcion}')
        checks.append(descripcion)

    def disposicion_valida():
        return pagina.evaluate("""() => {
          if (document.documentElement.scrollWidth > innerWidth) return false;
          const parrafos=[...document.querySelectorAll('.mv-texto > p,.mv-hoja p,.mv-panel p')];
          if (!parrafos.every(p=>p.scrollWidth<=p.clientWidth+1 && p.scrollHeight<=p.clientHeight+1)) return false;
          return [...document.querySelectorAll('.mv-ajustes,.mv-navegacion,.mv-controles,.mv-pestanas')].every(g=>{
            const rects=[...g.children].map(e=>e.getBoundingClientRect()).filter(r=>r.width && r.height);
            return rects.every((a,i)=>rects.slice(i+1).every(b=>
              Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1));
          });
        }""")

    pagina.goto(origen + '/motor-visual/demo.html?relato=demo-dos&modo=visual')
    pagina.wait_for_selector('#motor[data-listo="true"]')
    expect(pagina.locator('.mv-preferencias output')).to_have_text('20 px')
    checks.append('Se recuperan los 20 px guardados antes de esta fase')
    restablecer=pagina.get_by_role('button',name='Restablecer tamaño de letra a 8 px',exact=True)
    restablecer.focus(); restablecer.press('Enter')
    expect(pagina.locator('.mv-preferencias output')).to_have_text('8 px')
    pagina.reload(); pagina.wait_for_selector('#motor[data-listo="true"]')
    expect(pagina.locator('.mv-preferencias output')).to_have_text('8 px')
    checks.append('Restablecer por teclado guarda 8 px y persiste al recargar')
    aumentar=pagina.get_by_role('button',name='Aumentar tamaño de letra',exact=True)
    for tamano in [8,20,30]:
        restablecer.click()
        for _ in range((tamano-8)//2):
            aumentar.click()
        for modo in ['visual','texto']:
            pagina.get_by_role('button',name='Con recursos visuales' if modo=='visual' else 'Solo texto bíblico',exact=True).click()
            if modo=='visual':
                pagina.wait_for_selector('.mv-cierre')
                pagina.locator('[data-marcador="punto-b"]').first.click()
                pagina.get_by_role('button',name='Estudio',exact=True).click()
                pagina.locator('.mv-cierre .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
                comprobar(pagina.locator('.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Estudio extenso a {tamano} px')
                comprobar(disposicion_valida(), f'Estudio a {tamano} px sin recortes, superposición ni scroll horizontal')
                pagina.get_by_role('button',name='Devocional',exact=True).click()
                comprobar(pagina.locator('.mv-cierre .mv-hoja p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Devocional a {tamano} px')
                comprobar(pagina.locator('.mv-panel p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Panel de mapa a {tamano} px')
                v=pagina.locator('.mv-viewport').first.bounding_box()
                minimo=450 if nombre=='escritorio' else configuracion['viewport']['width']-50
                comprobar(v['width']>=minimo and abs(v['width']/v['height']-.75)<.01, f'Visor amplio y 3:4 con lectura a {tamano} px')
                muestras.append({'tamano':tamano,'visor_ancho':round(v['width'],2),'visor_alto':round(v['height'],2)})
                # La tipografía no debe agrandar ni achicar el área del visor.
                comprobar(abs(muestras[-1]['visor_ancho']-muestras[0]['visor_ancho'])<1, f'Visor independiente de letra a {tamano} px')
                capturar(pagina,SALIDA/'capturas'/f'compacto-{nombre}-{tamano}.png')
            else:
                expect(pagina.locator('#motor [data-educativo],#motor img')).to_have_count(0)
                checks.append(f'Solo texto a {tamano} px sin montar recursos')
            comprobar(pagina.locator('.mv-texto > p').first.evaluate('(p)=>getComputedStyle(p).fontSize')==f'{tamano}px', f'Lectura {modo} a {tamano} px')
            comprobar(disposicion_valida(), f'Disposición {modo} válida a {tamano} px')
            tactiles=pagina.locator('button,input[type=range]').evaluate_all("""es=>es.every(e=>{
              const r=e.getBoundingClientRect(); return !r.width || !r.height || (r.width>=44 && r.height>=44);
            })""")
            comprobar(tactiles, f'Controles independientes de {tamano} px: áreas de al menos 44 × 44 px en {modo}')
        # También comprobar la apariencia clara sin recortar párrafos en cada tamaño.
        tema=pagina.get_by_role('button',name='Modo oscuro',exact=True)
        tema.click(); comprobar(disposicion_valida(), f'Apariencia clara sin desbordamiento a {tamano} px'); tema.click()
    if nombre=='movil':
        pagina.set_viewport_size({'width':320,'height':740})
        for tamano in [8,20,30]:
            restablecer.click()
            for _ in range((tamano-8)//2): aumentar.click()
            pagina.get_by_role('button',name='Con recursos visuales',exact=True).click()
            pagina.wait_for_selector('.mv-cierre')
            comprobar(disposicion_valida(), f'Pantalla 320 px: sin superposiciones a {tamano} px')
            comprobar(pagina.locator('.mv-viewport').first.bounding_box()['width']>=270, f'Pantalla 320 px: visor útil a {tamano} px')
    comprobar(not errores, 'Sin errores JavaScript en la matriz 8, 20 y 30 px')
    contexto.close()
    return {'comprobaciones':checks,'muestras':muestras,'errores':errores}



def probar_composicion(browser, origen, configuracion, nombre):
    contexto=browser.new_context(**configuracion)
    pagina=contexto.new_page()
    checks, solicitudes, errores = [], [], []
    pagina.on('request',lambda r:solicitudes.append(r.url))
    pagina.on('pageerror',lambda e:errores.append(str(e)))
    url=origen+'/motor-visual/demo.html?relato=demo-dos&modo=texto&enfoque=devocional'

    def comprobar(condicion,descripcion):
        if not condicion: raise AssertionError(f'{nombre}, composición: {descripcion}')
        checks.append(descripcion)

    pagina.goto(url); pagina.wait_for_selector('#motor[data-listo="true"]')
    comprobar(pagina.locator('#motor').get_attribute('data-enfoque')=='devocional','Enlace directo con enfoque Devocional')
    comprobar(not any('/datos/estudios/' in u or u.endswith('/datos/recursos.json') or u.endswith('.svg') for u in solicitudes),'Solo texto + Devocional sin cargar contenido suplementario')
    comprobar(not any('/componentes/' in u and any(x in u for x in ['visor.js','explorador.js','portada.js','lectura-horizontal.js','descubrimiento.js']) for u in solicitudes),'Solo texto + Devocional sin descargar componentes visuales')
    comprobar(pagina.locator('#motor [data-educativo],#motor img').count()==0,'Solo texto + Devocional sin montaje educativo')
    pagina.get_by_role('button',name='Estudio',exact=True).click()
    comprobar(not any('/datos/estudios/' in u for u in solicitudes),'Cambiar enfoque en Solo texto no carga estudios')
    comprobar(pagina.locator('.mv-barra-lector [data-enfoque]').count()==2 and pagina.locator('.mv-barra-lector [data-modo]').count()==2,'Dos grupos independientes en la cabecera')
    comprobar(pagina.locator('.mv-barra-lector .mv-preferencias').is_visible(),'Controles tipográficos dentro de la cabecera')
    cabecera=pagina.locator('.mv-barra-lector').bounding_box()
    comprobar(cabecera['height']<=110 if nombre=='movil' else cabecera['height']<=60,'Cabecera compacta: hasta 110 px móvil y 60 px escritorio')
    comprobar(pagina.locator('.mv-indice button').count()==2,'Índice del capítulo con dos relatos sintéticos')
    expect(pagina.locator('.mv-indice [aria-current="true"]')).to_have_attribute('data-relato-indice','demo-dos')
    checks.append('Relato activo indicado en el índice')
    pagina.wait_for_function("""() => {
      const i=document.querySelector('.mv-indice'),a=i.querySelector('[aria-current="true"]').getBoundingClientRect(),n=i.getBoundingClientRect();
      return a.left>=n.left-1 && a.right<=n.right+1;
    }""")
    checks.append('El índice muestra completo el relato activo sin desplazar el documento')
    pagina.get_by_role('button',name='Con recursos visuales',exact=True).click(); pagina.wait_for_selector('.mv-cierre')
    orden=pagina.evaluate("""() => {
      const partes=['.mv-barra-lector','.mv-capitulo','.mv-titulo-relato','.mv-relato > .mv-referencia','.mv-relato .mv-portada','.mv-contexto','.mv-texto','.mv-cierre'].map(s=>document.querySelector(s));
      return partes.every(Boolean) && partes.slice(1).every((p,i)=>partes[i].compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING);
    }""")
    comprobar(orden,'Orden editorial completo: portada, contexto, versículos y cierre')
    comprobar(pagina.locator('.mv-cierre .mv-pestanas button').all_text_contents()==['Exégesis','Enseñanzas'],'Cierre de Estudio con Exégesis y Enseñanzas')
    pagina.locator('.mv-contexto .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
    expect(pagina.locator('.mv-contexto output')).to_have_text('2 / 2')
    expect(pagina.locator('.mv-cierre output')).to_have_text('1 / 2')
    checks.append('Contexto paginado sin cambiar el cierre')
    pagina.locator('.mv-cierre .mv-hoja').focus(); pagina.keyboard.press('ArrowRight')
    expect(pagina.locator('.mv-cierre output')).to_have_text('2 / 2')
    expect(pagina.locator('.mv-contexto output')).to_have_text('2 / 2')
    checks.append('Cierre paginado sin cambiar el contexto')
    pagina.locator('[data-marcador="punto-b"]').first.click()
    pagina.locator('input[type=range]').first.fill('250'); pagina.locator('input[type=range]').first.dispatch_event('input')
    pagina.evaluate('window.__visorEditorial=document.querySelector(".mv-visor")')
    antes=len([u for u in solicitudes if '/datos/' in u])
    pagina.get_by_role('button',name='Devocional',exact=True).click()
    expect(pagina.locator('.mv-contexto')).to_have_count(0)
    expect(pagina.locator('.mv-devocional')).to_have_count(1)
    comprobar(pagina.evaluate('window.__visorEditorial===document.querySelector(".mv-visor")'),'Cambiar enfoque conserva la misma instancia del visor')
    comprobar(pagina.locator('input[type=range]').first.input_value()=='250','Cambiar enfoque conserva el zoom')
    comprobar(pagina.locator('.mv-panel h4').first.inner_text()=='Punto B','Cambiar enfoque conserva el marcador seleccionado')
    comprobar(antes==len([u for u in solicitudes if '/datos/' in u]),'Cambiar enfoque no vuelve a solicitar los datos visuales')
    pagina.go_back(); pagina.wait_for_selector('.mv-contexto')
    expect(pagina.locator('.mv-contexto output')).to_have_text('2 / 2')
    expect(pagina.locator('.mv-cierre output')).to_have_text('2 / 2')
    comprobar(pagina.evaluate('window.__visorEditorial===document.querySelector(".mv-visor")'),'Atrás restaura Estudio sin reconstruir el visor')
    pagina.go_forward(); pagina.wait_for_selector('.mv-devocional')
    checks.append('Adelante restaura el enfoque Devocional')
    pagina.get_by_role('button',name='Solo texto bíblico',exact=True).click()
    expect(pagina.locator('#motor [data-educativo],#motor img, #motor dialog')).to_have_count(0)
    comprobar(pagina.locator('#motor').get_attribute('data-enfoque')=='devocional','Solo texto conserva la elección de enfoque')
    pagina.get_by_role('button',name='Capítulo siguiente:',exact=False).click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-tres')
    comprobar(pagina.locator('.mv-indice button').count()==1,'Índice actualizado al navegar al otro capítulo')
    comprobar(pagina.locator('#motor').get_attribute('data-enfoque')=='devocional','Navegación conserva el enfoque')
    pagina.get_by_role('button',name='Con recursos visuales',exact=True).click(); pagina.wait_for_selector('.mv-devocional')
    pagina.get_by_role('button',name='Capítulo anterior:',exact=False).click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-uno')
    pagina.locator('[data-relato-indice="demo-dos"]').click()
    expect(pagina.locator('#motor')).to_have_attribute('data-relato','demo-dos')
    pagina.wait_for_selector('.mv-devocional')
    pagina.get_by_role('button',name='Estudio',exact=True).click(); pagina.wait_for_selector('.mv-contexto')
    expect(pagina.locator('.mv-contexto output')).to_have_text('2 / 2')
    checks.append('Volver al relato recupera su página de contexto')
    # Capturas del orden editorial desde las primeras páginas.
    pagina.locator('.mv-contexto nav button').first.click()
    if not pagina.locator('.mv-cierre nav button').first.is_disabled():
        pagina.locator('.mv-cierre nav button').first.click()
    capturar(pagina,SALIDA/'capturas'/f'editorial-{nombre}-estudio.png')
    pagina.get_by_role('button',name='Devocional',exact=True).click()
    capturar(pagina,SALIDA/'capturas'/f'editorial-{nombre}-devocional.png')
    if nombre=='movil':
        pagina.set_viewport_size({'width':320,'height':740})
        comprobar(pagina.locator('.mv-barra-lector').bounding_box()['height']<=110,'Cabecera compacta también a 320 px')
        comprobar(pagina.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Sin desbordamiento horizontal del documento a 320 px')
    comprobar(not errores,'Sin errores JavaScript en las cuatro combinaciones')
    contexto.close()
    return {'comprobaciones':checks,'alto_cabecera':cabecera['height'],'errores':errores}


def main():
    baseline = originales()
    total_esquemas = validar_esquemas()
    handler = partial(Silencioso, directory=str(REPO))
    server = ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origen = f'http://127.0.0.1:{server.server_port}'
    resultado = {'ok':False,'esquemas':{'documentos_validos':total_esquemas},'suites':{},'demo':{},'accesibilidad':{},'compactacion':{},'composicion':{}}
    try:
        with sync_playwright() as p:
            ejecutable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
            browser = p.chromium.launch(executable_path=ejecutable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            resultado['chromium'] = browser.version
            configuraciones = {
                'escritorio':{'viewport':{'width':1280,'height':900}},
                'movil':{'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'device_scale_factor':2},
            }
            for nombre, config in configuraciones.items():
                contexto = browser.new_context(**config)
                pagina = contexto.new_page()
                errores = []
                pagina.on('pageerror', lambda e: errores.append(str(e)))
                pagina.goto(origen + '/motor-visual/pruebas/runner.html')
                pagina.wait_for_function('window.__resultados',timeout=60000)
                suite = pagina.evaluate('window.__resultados')
                suite['errores_no_controlados'] = errores
                resultado['suites'][nombre] = suite
                assert suite['total'] == suite['aprobadas'] and not errores, suite
                contexto.close()
                resultado['demo'][nombre] = probar_demo(browser,origen,config,nombre)
                resultado['accesibilidad'][nombre] = probar_accesibilidad(browser,origen,config,nombre)
                resultado['compactacion'][nombre] = probar_compactacion(browser,origen,config,nombre)
                resultado['composicion'][nombre] = probar_composicion(browser,origen,config,nombre)
            browser.close()
        assert originales() == baseline, 'Se alteró un archivo preexistente durante las pruebas'
        resultado['archivos_originales_intactos'] = len(baseline)
        resultado['rama'] = subprocess.check_output(['git','branch','--show-current'],cwd=REPO,text=True).strip()
        resultado['commit_base'] = subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
        resultado['ok'] = True
    except Exception as error:
        resultado['error'] = str(error)
        raise
    finally:
        server.shutdown()
        server.server_close()
        (SALIDA / 'resultados.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ok':resultado['ok'],'chromium':resultado['chromium'],'esquemas':total_esquemas,
                      'suites':{k:f"{v['aprobadas']}/{v['total']}" for k,v in resultado['suites'].items()},
                      'demo':{k:len(v['comprobaciones']) for k,v in resultado['demo'].items()},
                      'accesibilidad':{k:len(v['comprobaciones']) for k,v in resultado['accesibilidad'].items()},
                      'compactacion':{k:len(v['comprobaciones']) for k,v in resultado['compactacion'].items()},
                      'composicion':{k:len(v['comprobaciones']) for k,v in resultado['composicion'].items()},
                      'archivos_originales_intactos':resultado['archivos_originales_intactos']},ensure_ascii=False))


if __name__ == '__main__':
    main()
