function validarCrearEstudiante() {
  limpiarErroresEstudiantes();

  if (!cedulaCrear.value.trim()) return marcarError(cedulaCrear, "Cédula requerida");
  if (!nombresCrear.value.trim()) return marcarError(nombresCrear, "Nombres requeridos");
  if (!apellidosCrear.value.trim()) return marcarError(apellidosCrear, "Apellidos requeridos");
  if (!fechaNacimientoCrear.value) return marcarError(fechaNacimientoCrear, "Fecha requerida");
  if (!sexoCrear.value) return marcarError(sexoCrear, "Seleccione sexo");

  return true;
}

function validarEditarEstudiante() {
  limpiarErroresEstudiantes();

  if (!cedulaEditar.value.trim()) return marcarError(cedulaEditar, "Cédula requerida");
  if (!nombresEditar.value.trim()) return marcarError(nombresEditar, "Nombres requeridos");
  if (!apellidosEditar.value.trim()) return marcarError(apellidosEditar, "Apellidos requeridos");

  return true;
}
