async function retirarEstudiante(id_inscripcion) {
  const confirmar = await confirmarAccion("¿Retirar estudiante?");
  if (!confirmar) return;

  const data = await API.estudiantes.retirar(id_inscripcion);

  if (!data?.ok) {
    alert("Error: " + (data?.error || "Error inesperado"));
    return;
  }

  await cargarEstudiantes();
}
