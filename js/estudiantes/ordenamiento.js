function ordenarEstudiantes(columna) {
  if (window._ordenarPor === columna) {
    window._direccionOrden = window._direccionOrden === "asc" ? "desc" : "asc";
  } else {
    window._ordenarPor = columna;
    window._direccionOrden = "asc";
  }

  cargarEstudiantes();
}
