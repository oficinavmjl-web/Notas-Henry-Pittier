async function abrirPromocionEstudiante(id_inscripcion, seccion_id, anio_escolar_id) {
  // Referencias a los inputs del modal
  const inputId = document.getElementById("promoverIdInscripcion");
  const selectGrado = document.getElementById("promoverNuevoGrado");
  const selectSeccion = document.getElementById("promoverNuevaSeccion");

  // Guardar ID de inscripción
  inputId.value = id_inscripcion;

  // 1. Cargar grados
  const { data: grados, error: errGrados } = await supabase
    .from("grados")
    .select("*")
    .order("id_grado");

  if (errGrados) {
    alert("Error cargando grados");
    return;
  }

  selectGrado.innerHTML = grados
    .map(g => `<option value="${g.id_grado}">${g.nombre}</option>`)
    .join("");

  // 2. Configurar evento onchange para cargar secciones
  selectGrado.onchange = async () => {
    const grado = selectGrado.value;

    const { data: secciones, error: errSec } = await supabase
      .from("secciones")
      .select("*")
      .eq("grado_id", grado);

    if (errSec) {
      alert("Error cargando secciones");
      return;
    }

    selectSeccion.innerHTML = secciones
      .map(s => `<option value="${s.id_seccion}">${s.nombre}</option>`)
      .join("");
  };

  // 3. Disparar carga inicial de secciones
  await selectGrado.dispatchEvent(new Event("change"));

  // 4. Abrir modal SOLO cuando todo esté cargado
  new bootstrap.Modal("#modalPromoverEstudiante").show();
}



document.getElementById("btnConfirmarPromocion").addEventListener("click", async (event) => {
  const btn = event.target;

  // Referencias a los inputs
  const inputId = document.getElementById("promoverIdInscripcion");
  const selectGrado = document.getElementById("promoverNuevoGrado");
  const selectSeccion = document.getElementById("promoverNuevaSeccion");

  const id_inscripcion = inputId.value;
  const nuevo_grado = selectGrado.value;
  const nueva_seccion = selectSeccion.value;

  if (!nuevo_grado || !nueva_seccion) {
    alert("Debe seleccionar grado y sección");
    return;
  }

  // Deshabilitar botón para evitar doble clic
  btn.disabled = true;

  try {
    const data = await API.estudiantes.promover(id_inscripcion);

    if (!data?.ok) {
      alert("Error: " + (data?.error || "Error inesperado"));
      return;
    }

    // Cerrar modal
    bootstrap.Modal.getInstance("#modalPromoverEstudiante").hide();

    // Recargar tabla principal
    await cargarEstudiantes();

    // Volver a abrir detalles del estudiante
    await abrirDetallesEstudiante(data.id_estudiante);

  } finally {
    btn.disabled = false;
  }
});

