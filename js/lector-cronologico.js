/* =========================================================
   LECTOR CRONOLÓGICO
   Mi Biblia Web

   Controla la navegación entre:
   Unificado · Mateo · Marcos · Lucas · Juan

   La carga de los textos bíblicos pertenece a:
   lector-biblico.js
========================================================= */


document.addEventListener("DOMContentLoaded", () => {

    iniciarSelectoresDeRelatos();

});


/* =========================================================
   SELECTORES DE CADA RELATO
========================================================= */

function iniciarSelectoresDeRelatos() {

    const relatos =
        document.querySelectorAll(".relato");


    relatos.forEach(relato => {

        const botones =
            relato.querySelectorAll("[data-modo]");

        const contenidos =
            relato.querySelectorAll("[data-contenido]");


        botones.forEach(boton => {

            boton.addEventListener("click", () => {

                const modo =
                    boton.dataset.modo;


                cambiarModoDeLectura(
                    relato,
                    modo,
                    botones,
                    contenidos
                );

            });

        });

    });

}


/* =========================================================
   CAMBIAR MODO DE LECTURA
========================================================= */

function cambiarModoDeLectura(
    relato,
    modo,
    botones,
    contenidos
) {

    /* -----------------------------------------------------
       Desactivar selección actual
    ----------------------------------------------------- */

    botones.forEach(boton => {

        boton.classList.remove("activo");

        boton.setAttribute(
            "aria-selected",
            "false"
        );

    });


    contenidos.forEach(contenido => {

        contenido.classList.remove("activo");

    });


    /* -----------------------------------------------------
       Activar botón seleccionado
    ----------------------------------------------------- */

    const botonActivo =
        relato.querySelector(
            `[data-modo="${modo}"]`
        );


    if (botonActivo) {

        botonActivo.classList.add("activo");

        botonActivo.setAttribute(
            "aria-selected",
            "true"
        );

    }


    /* -----------------------------------------------------
       Mostrar contenido correspondiente
    ----------------------------------------------------- */

    const contenidoActivo =
        relato.querySelector(
            `[data-contenido="${modo}"]`
        );


    if (contenidoActivo) {

        contenidoActivo.classList.add("activo");

    }

}