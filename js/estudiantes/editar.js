async function abrirEditarEstudiante(id) {
  limpiarErroresEstudiantes();

  const { data, error } = await supabase
    .from("estudiantes")
    .select("*")
    .eq("id_estudiante", id)
    .single();

  if (error) return alert("Error cargando estudiante");

  idEstudianteEditar.value = data.id_estudiante;
  cedulaEditar.value = data.cedula;
  nombresEditar.value = data.nombres;
  apellidosEditar.value = data.apellidos;
  fechaNacimientoEditar.value = data.fecha_nacimiento;
  sexoEditar.value = data.sexo;
  telefonoEditar.value = data.telefono;
  direccionEditar.value = data.direccion;
  representanteEditar.value = data.representante;
  telefonoRepresentanteEditar.value = data.telefono_representante;

  new bootstrap.Modal("#modalEditarEstudiante").show();
}

document.getElementById("btnActualizarEstudiante").addEventListener("click", async () => {
  const btn = document.getElementById("btnActualizarEstudiante");
  if (!validarEditarEstudiante()) return;

  await runAsyncWithButton(btn, async () => {
    const id = idEstudianteEditar.value;

    const payload = {
      cedula: cedulaEditar.value.trim(),
      nombres: nombresEditar.value.trim(),
      apellidos: apellidosEditar.value.trim(),
      fecha_nacimiento: fechaNacimientoEditar.value,
      sexo: sexoEditar.value,
      telefono: telefonoEditar.value.trim(),
      direccion: direccionEditar.value.trim(),
      representante: representanteEditar.value.trim(),
      telefono_representante: telefonoRepresentanteEditar.value.trim()
    };

    const { error } = await supabase
      .from("estudiantes")
      .update(payload)
      .eq("id_estudiante", id);

    if (error) {
      alert("Error actualizando estudiante: " + error.message);
      return;
    }

    bootstrap.Modal.getInstance("#modalEditarEstudiante").hide();
    await cargarEstudiantes();
  }, 'Actualizando...');
});
