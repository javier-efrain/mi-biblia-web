import { crearServicioBiblia } from './servicios/biblia.js';
import { crearServicioContenidos } from './servicios/contenidos.js';
import { crearMotor } from './estado/lectura.js';
import { leerRuta } from './estado/navegacion.js';
import { crearPreferencias } from './estado/preferencias.js';
import { crearControlesPreferencias } from './componentes/preferencias.js';

const root = document.querySelector('#motor');
const preferencias = crearPreferencias();
const controlesPreferencias = crearControlesPreferencias(preferencias,{ compacto:true }).el;
try {
  const contenidos = crearServicioContenidos({ baseURL:new URL('../datos/',import.meta.url) });
  const catalogo = await contenidos.cargarCatalogo();
  const biblia = crearServicioBiblia({ baseURL:new URL('../pruebas/fixtures/',import.meta.url), version:'DEMO' });
  await crearMotor({ root,catalogo,biblia,contenidos,controlesPreferencias,inicial:leerRuta(location.search,catalogo),usarHistorial:true });
  root.dataset.listo = 'true';
} catch (error) {
  root.textContent = 'No se pudo iniciar la demostración. Serví la carpeta mediante HTTP y revisá los datos.';
  root.setAttribute('role','alert');
}
