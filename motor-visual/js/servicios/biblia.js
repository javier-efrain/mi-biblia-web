const enteroPositivo = n => Number.isInteger(n) && n > 0;
export function validarReferencia(ref) {
  if (!ref || !['DEMO', 'RVC'].includes(ref.version) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ref.libro)) {
    throw new Error('Referencia bíblica inválida.');
  }
  if (!Array.isArray(ref.rangos) || !ref.rangos.length) throw new Error('Faltan rangos.');
  let anterior = null;
  for (const r of ref.rangos) {
    if (![r.capitulo, r.desde, r.hasta].every(enteroPositivo) || r.desde > r.hasta || r.hasta > 200) {
      throw new Error('Rango inválido.');
    }
    if (anterior && (r.capitulo < anterior.capitulo || (r.capitulo === anterior.capitulo && r.desde <= anterior.hasta))) {
      throw new Error('Los rangos deben estar ordenados y no superponerse.');
    }
    anterior = r;
  }
  return ref;
}

// El origen y la versión son inyectables. La demo nunca configura el origen RVC.
// No se modifica la fuente ni se convierte su texto en contenido educativo.
export function crearServicioBiblia({ baseURL, version, fetcher = fetch }) {
  const base = new URL(baseURL);
  const cache = new Map();
  async function cargarLibro(libro) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(libro)) throw new Error('Libro inválido.');
    if (!cache.has(libro)) {
      const peticion = (async () => {
        const respuesta = await fetcher(new URL(`${libro}.json`, base));
        if (!respuesta.ok) throw new Error(`No se pudo cargar el libro (${respuesta.status}).`);
        const datos = await respuesta.json();
        if (datos.version !== version || datos.slug !== libro || !datos.capitulos || typeof datos.capitulos !== 'object') {
          throw new Error('Fuente bíblica incompatible.');
        }
        return datos;
      })();
      cache.set(libro, peticion);
      peticion.catch(() => cache.delete(libro));
    }
    return cache.get(libro);
  }
  async function obtenerPasaje(referencia) {
    validarReferencia(referencia);
    if (referencia.version !== version) throw new Error('Versión no configurada.');
    const libro = await cargarLibro(referencia.libro);
    const texto = [];
    for (const rango of referencia.rangos) {
      const capitulo = libro.capitulos[String(rango.capitulo)];
      if (!capitulo) throw new Error('Capítulo inexistente.');
      for (let n = rango.desde; n <= rango.hasta; n++) {
        const contenido = capitulo[String(n)];
        if (typeof contenido !== 'string' || !contenido.trim()) throw new Error('Versículo inexistente.');
        texto.push({ libro: referencia.libro, capitulo: rango.capitulo, numero: n, texto: contenido });
      }
    }
    return { version, libro: libro.libro, texto };
  }
  return { obtenerPasaje };
}
