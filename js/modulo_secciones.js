// /public/js/modulo_secciones.js

// Guardar secciones en memoria
window._secciones = [];

// Cargar años escolares al iniciar
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await cargarAniosEscolares();
  } catch (e) {
    console.error("Error cargando años escolares:", e);
  }
});



