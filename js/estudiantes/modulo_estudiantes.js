// Variables globales
window._estudiantes = [];
window._estudiantesFiltrados = [];
window._paginaActual = 1;
window._tamanoPagina = 20;
window._ordenarPor = "apellidos";
window._direccionOrden = "asc";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await cargarFiltrosEstudiantes();
    await cargarEstudiantes();
  } catch (e) {
    console.error("Error inicializando módulo estudiantes:", e);
  }
});


async function inicializarModalesEstudiantes() {
  await cargarModal("../pages/estudiantes/modales/modal_crear.html");
  await cargarModal("../pages/estudiantes/modales/modal_editar.html");
  await cargarModal("../pages/estudiantes/modales/modal_detalles.html");
  await cargarModal("../pages/estudiantes/modales/modal_cambio_seccion.html");
  await cargarModal("../pages/estudiantes/modales/modal_promover.html");
  await cargarModal("../pages/estudiantes/modales/modal_repetir.html");
  await cargarModal("../pages/estudiantes/modales/modal_retirar.html");
}

async function cargarModal(ruta) {
  const res = await fetch(ruta);
  const html = await res.text();
  document.getElementById("modalesEstudiantes").insertAdjacentHTML("beforeend", html);
}

async function inicializarModalesEstudiantes() {
  await cargarModal("../pages/estudiantes/modales/modal_crear.html");
  await cargarModal("../pages/estudiantes/modales/modal_editar.html");
  await cargarModal("../pages/estudiantes/modales/modal_detalles.html");
  await cargarModal("../pages/estudiantes/modales/modal_cambio_seccion.html");
  await cargarModal("../pages/estudiantes/modales/modal_promover.html");
  await cargarModal("../pages/estudiantes/modales/modal_repetir.html");
  await cargarModal("../pages/estudiantes/modales/modal_retirar.html");
}

inicializarModalesEstudiantes();
