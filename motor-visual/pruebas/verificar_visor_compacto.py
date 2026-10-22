"""Pruebas locales del visor compacto real y sintético; no publica contenido."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import argparse,json,os,shutil,threading
from playwright.sync_api import sync_playwright,expect

REPO=Path(__file__).resolve().parents[2]

class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def main(salida):
 salida.mkdir(parents=True,exist_ok=True)
 checks=[];medidas=[]
 def check(ok,texto):
  assert ok,texto
  checks.append(texto)
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=REPO))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
   for nombre,w,h in [('android',390,844),('iphone',393,852),('pequeno',320,568),('horizontal',844,390),('escritorio',1280,900)]:
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900)
    page=ctx.new_page();errores=[];fallos=[];requests=[]
    page.on('pageerror',lambda e:errores.append(str(e)))
    page.on('response',lambda r:fallos.append(r.url) if r.status>=400 else None)
    page.on('request',lambda r:requests.append(r.url))
    url=f'http://127.0.0.1:{server.server_port}/motor-visual/desarrollo/index.html?relato=mc-12-1-12&modo=visual&enfoque=estudio'
    page.goto(url);page.wait_for_selector('#motor[data-listo=true]')
    for tamano in [8,12,20,30]:
     page.evaluate('(n)=>document.body.style.setProperty("--mv-tamano-lectura",n+"px")',tamano)
     page.wait_for_timeout(80)
     for indice in [0,1]:
      r=page.locator('.mv-recurso').nth(indice);barra=r.locator('.mv-herramientas');panel=r.locator('.mv-panel')
      tag=f'{nombre}/{tamano}px/recurso{indice+1}'
      check(barra.locator('button').count()==4 and barra.locator('input').count()==0,tag+' barra sin deslizador ni botones inactivos')
      check(barra.evaluate('e=>[...e.children].every(c=>Math.abs((c.getBoundingClientRect().y+c.getBoundingClientRect().height/2)-(e.firstElementChild.getBoundingClientRect().y+e.firstElementChild.getBoundingClientRect().height/2))<2)'),tag+' barra en una fila')
      check(barra.locator('button').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44&&e.getAttribute("aria-label"))'),tag+' botones táctiles y accesibles')
      check(r.locator('.mv-elementos button[aria-pressed=true]').count()==1 and r.locator('[data-marcador][aria-pressed=true]').count()==1,tag+' selección inicial única')
      check(panel.locator('.mv-estudio').count()==1 and not r.locator('.mv-ficha-recurso').get_attribute('open'),tag+' explicación única; ficha cerrada')
      expected=json.loads((REPO/'motor-visual/desarrollo/contenido/catalogo.json').read_text())['relatos'][0]['recursos'][indice]['marcadores']
      for marker in expected:
       r.locator(f'[data-elemento="{marker["id"]}"]').click()
       expect(r.locator(f'[data-marcador="{marker["id"]}"]')).to_have_attribute('aria-pressed','true')
       check(panel.locator('h4').inner_text()==marker['paginas'][0]['titulo'],tag+' panel '+marker['titulo'])
       check(panel.locator('.mv-pagina-columnas').count()==1,tag+' sin columnas de medición duplicadas')
      # La selección desde la imagen y el teclado da el mismo resultado.
      first=expected[0];r.locator('[data-marcador]').first.click()
      expect(r.locator('[data-elemento]').first).to_have_attribute('aria-pressed','true')
      hoja=panel.locator('.mv-hoja');hoja.focus();page.keyboard.press('ArrowRight')
      antes=panel.locator('output').inner_text();seleccion=r.locator('[data-elemento][aria-pressed=true]').get_attribute('data-elemento')
      barra.get_by_role('button',name='Ocultar puntos',exact=True).click()
      check(panel.is_hidden() and r.locator('.mv-elementos').is_hidden() and r.locator('[data-marcador]:visible').count()==0,tag+' ocultación completa')
      check(r.locator('img').is_visible() and barra.is_visible(),tag+' imagen limpia y barra visibles')
      barra.get_by_role('button',name='Mostrar puntos',exact=True).focus();page.keyboard.press('Enter')
      expect(r.locator(f'[data-elemento="{seleccion}"]')).to_have_attribute('aria-pressed','true')
      check(panel.locator('output').inner_text()==antes,tag+' restaura explicación y página')
      barra.get_by_role('button',name='Aumentar zoom',exact=True).click();expect(barra.locator('output')).to_have_attribute('data-zoom','125')
      r.locator('.mv-viewport').evaluate('e=>e.scrollTo(25,35)')
      barra.get_by_role('button',name='Restablecer',exact=True).click();expect(barra.locator('output')).to_have_attribute('data-zoom','100')
      check(r.locator('.mv-viewport').evaluate('e=>e.scrollTop===0&&e.scrollLeft===0'),tag+' restablece desplazamiento')
      check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),tag+' sin desbordamiento de página')
      check(r.locator('.mv-viewport').evaluate('e=>Math.abs(e.clientWidth/e.clientHeight-.75)<.01'),tag+' marco 3:4')
      if tamano==12:
       altura=r.bounding_box()['height'];medidas.append({'pantalla':nombre,'recurso':indice+1,'alto':round(altura),'altoPantalla':h})
       if nombre in ['android','iphone']:check(altura<=h,tag+' imagen, botones y explicación caben juntos')
       if indice==0:r.screenshot(path=str(salida/f'{nombre}-visor-12.png'),animations='disabled')
    check(not errores and not fallos,nombre+' sin errores JS/HTTP')
    check(all(u.startswith(f'http://127.0.0.1:{server.server_port}/') for u in requests),nombre+' sin solicitudes externas')
    ctx.close()
   b.close()
 finally:server.shutdown();server.server_close()
 resultado={'ok':True,'comprobaciones':len(checks),'medidas':medidas,'casos':checks,'limitacion':'iPhone simulado en Chromium; Safari y dispositivos físicos pendientes.'}
 (salida/'resultados.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in resultado.items() if k!='casos'},ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--salida',type=Path,default=Path(__file__).resolve().parent/'resultados-visor-compacto');args=parser.parse_args();main(args.salida)
