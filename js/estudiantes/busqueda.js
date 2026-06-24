document.getElementById("btnBuscarEstudiantes").addEventListener("click", () => {
  window._paginaActual = 1;
  cargarEstudiantes();
});

document.getElementById("buscarEstudiante").addEventListener("input", () => {
  window._paginaActual = 1;
  cargarEstudiantes();
});
