/* =========================================================
   LECTOR BÍBLICO
   Proyecto Mi Biblia Web
========================================================= */


/**
 * Ruta base donde están almacenados los archivos bíblicos.
 *
 * Al comenzar con "/" siempre buscamos desde la raíz
 * del sitio, independientemente de dónde esté el HTML.
 */
const RUTA_BIBLIA = new URL(
    "../biblia/rvc/",
    document.currentScript.src
).href;

/**
 * Caché de libros ya cargados.
 *
 * Evita descargar mateo.json varias veces si una misma
 * página necesita consultar varios pasajes de Mateo.
 */
const cacheBiblia = {};


/* =========================================================
   CARGAR LIBRO
========================================================= */

/**
 * Carga un libro bíblico desde su archivo JSON.
 *
 * Ejemplo:
 *
 * cargarLibro("mateo")
 *
 * buscará:
 *
 * /biblia/rvc/mateo.json
 */
async function cargarLibro(libro) {

    libro = libro.toLowerCase();


    // Si ya cargamos el libro anteriormente,
    // lo devolvemos directamente desde memoria.

    if (cacheBiblia[libro]) {
        return cacheBiblia[libro];
    }


    const ruta =
        `${RUTA_BIBLIA}${libro}.json`;


    const respuesta =
        await fetch(ruta);


    if (!respuesta.ok) {

        throw new Error(
            `No se pudo cargar el libro "${libro}". Ruta: ${ruta}`
        );

    }


    const datos =
        await respuesta.json();


    // Guardamos el libro en memoria.

    cacheBiblia[libro] = datos;


    return datos;
}


/* =========================================================
   INTERPRETAR VERSÍCULOS
========================================================= */

/**
 * Convierte expresiones como:
 *
 * "18-22"
 *
 * en:
 *
 * [18, 19, 20, 21, 22]
 *
 *
 * También acepta:
 *
 * "12-14,20-25"
 *
 * y devuelve:
 *
 * [12,13,14,20,21,22,23,24,25]
 *
 *
 * También acepta un único versículo:
 *
 * "18"
 */
function interpretarVersiculos(expresion) {

    const resultado = [];

    const bloques =
        String(expresion).split(",");


    bloques.forEach(bloque => {

        bloque = bloque.trim();


        // Rango: 18-22

        if (bloque.includes("-")) {

            const partes =
                bloque.split("-");

            const inicio =
                Number(partes[0]);

            const fin =
                Number(partes[1]);


            if (
                Number.isNaN(inicio) ||
                Number.isNaN(fin)
            ) {

                throw new Error(
                    `Rango de versículos inválido: ${bloque}`
                );

            }


            for (
                let versiculo = inicio;
                versiculo <= fin;
                versiculo++
            ) {

                resultado.push(versiculo);

            }

        }


        // Versículo individual

        else {

            const versiculo =
                Number(bloque);


            if (Number.isNaN(versiculo)) {

                throw new Error(
                    `Versículo inválido: ${bloque}`
                );

            }


            resultado.push(versiculo);

        }

    });


    return resultado;
}


/* =========================================================
   OBTENER PASAJE
========================================================= */

/**
 * Obtiene un pasaje bíblico.
 *
 * Ejemplo:
 *
 * obtenerPasaje(
 *     "mateo",
 *     21,
 *     "18-22"
 * )
 */
async function obtenerPasaje(
    libro,
    capitulo,
    versiculos
) {

    const biblia =
        await cargarLibro(libro);


    const numeroCapitulo =
        String(capitulo);


    const capituloBiblico =
        biblia.capitulos[numeroCapitulo];


    if (!capituloBiblico) {

        throw new Error(
            `${biblia.libro} no contiene el capítulo ${capitulo}.`
        );

    }


    const numeros =
        interpretarVersiculos(versiculos);


    const resultado = [];


    numeros.forEach(numero => {

        const texto =
            capituloBiblico[String(numero)];


        if (!texto) {

            console.warn(
                `No se encontró ${biblia.libro} ${capitulo}:${numero}`
            );

            return;

        }


        resultado.push({

            numero: numero,

            texto: texto

        });

    });


    return {

        version: biblia.version,

        libro: biblia.libro,

        abreviatura: biblia.abreviatura,

        capitulo: Number(capitulo),

        versiculos: versiculos,

        texto: resultado

    };
}


/* =========================================================
   GENERAR HTML
========================================================= */

/**
 * Convierte el pasaje obtenido en HTML.
 */
function generarHTMLPasaje(pasaje) {

    let html = "";


    pasaje.texto.forEach(versiculo => {

        html += `
            <p>
                <sup class="versiculo">
                    ${versiculo.numero}
                </sup>
                ${versiculo.texto}
            </p>
        `;

    });


    return html;
}


/* =========================================================
   CARGAR PASAJE EN LA PÁGINA
========================================================= */

/**
 * Función principal.
 *
 * Ejemplo:
 *
 * cargarPasaje(
 *     "mateo",
 *     21,
 *     "18-22",
 *     "#texto-prueba"
 * );
 */
async function cargarPasaje(
    libro,
    capitulo,
    versiculos,
    destino
) {

    const contenedor =
        typeof destino === "string"
            ? document.querySelector(destino)
            : destino;


    if (!contenedor) {

        console.error(
            `No se encontró el destino: ${destino}`
        );

        return;

    }


    try {

        contenedor.innerHTML =
            `<p class="cargando-biblia">
                Cargando texto bíblico…
            </p>`;


        const pasaje =
            await obtenerPasaje(
                libro,
                capitulo,
                versiculos
            );


        contenedor.innerHTML =
            generarHTMLPasaje(pasaje);


    }

    catch (error) {

        console.error(error);


        contenedor.innerHTML = `
            <p class="error-biblia">
                No fue posible cargar el texto bíblico.
            </p>
        `;

    }

}

/* =========================================================
   CARGA AUTOMÁTICA DE PASAJES
========================================================= */

/**
 * Busca en la página todos los elementos que tengan:
 *
 * data-biblia
 *
 * y carga automáticamente el pasaje indicado.
 *
 * Ejemplo:
 *
 * <div
 *     data-biblia
 *     data-libro="mateo"
 *     data-capitulo="21"
 *     data-versiculos="18-22">
 * </div>
 */
async function cargarPasajesAutomaticos() {

    const elementos =
        document.querySelectorAll("[data-biblia]");


    for (const elemento of elementos) {

        const libro =
            elemento.dataset.libro;

        const capitulo =
            elemento.dataset.capitulo;

        const versiculos =
            elemento.dataset.versiculos;


        /*
         * Si falta algún dato, no intentamos cargar
         * el pasaje y dejamos un aviso en consola.
         */

        if (
            !libro ||
            !capitulo ||
            !versiculos
        ) {

            console.warn(
                "Pasaje bíblico incompleto:",
                elemento
            );

            continue;
        }


        await cargarPasaje(
            libro,
            capitulo,
            versiculos,
            elemento
        );

    }

}


/* =========================================================
   INICIAR CARGA AUTOMÁTICA
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    cargarPasajesAutomaticos
);