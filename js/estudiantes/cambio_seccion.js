async function abrirCambioSeccion(id_inscripcion, seccion_id, anio_escolar_id) {
  const inputId = document.getElementById("cambioIdInscripcion");
  const selectSeccion = document.getElementById("cambioNuevaSeccion");

  inputId.value = id_inscripcion;

  // Obtener grado actual
  const { data: secActual } = await supabase
    .from("secciones")
    .select("grado_id")
    .eq("id_seccion", seccion_id)
    .single();

  // Cargar secciones del mismo grado
  const { data: secciones } = await supabase
    .from("secciones")
    .select("*")
    .eq("grado_id", secActual.grado_id)
    .eq("activo", true);

  selectSeccion.innerHTML = secciones
    .map(s => `<option value="${s.id_seccion}">${s.nombre}</option>`)
    .join("");

  new bootstrap.Modal("#modalCambioSeccion").show();
}


document.getElementById("btnConfirmarCambioSeccion").addEventListener("click", async (event) => {
  const btn = event.target;

  const id_inscripcion = document.getElementById("cambioIdInscripcion").value;
  const nueva_seccion = document.getElementById("cambioNuevaSeccion").value;

  if (!nueva_seccion) {
    alert("Debe seleccionar una sección");
    return;
  }

  btn.disabled = true;

  try {
    const data = await API.estudiantes.cambiarSeccion(id_inscripcion, nueva_seccion);

    if (!data?.ok) {
      alert("Error: " + (data?.error || "Error inesperado"));
      return;
    }

    bootstrap.Modal.getInstance("#modalCambioSeccion").hide();
    await cargarEstudiantes();
    await abrirDetallesEstudiante(data.id_estudiante);

  } finally {
    btn.disabled = false;
  }
});
