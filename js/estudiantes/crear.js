document.getElementById("btnCrearEstudiante").addEventListener("click", () => {
  limpiarErroresEstudiantes();
  document.getElementById("modalCrearEstudiante").querySelector("form")?.reset();
  new bootstrap.Modal("#modalCrearEstudiante").show();
});

document.getElementById("btnGuardarEstudiante").addEventListener("click", async () => {
  const btn = document.getElementById("btnGuardarEstudiante");
  if (!validarCrearEstudiante()) return;

  await runAsyncWithButton(btn, async () => {
    const payload = {
      cedula: cedulaCrear.value.trim(),
      nombres: nombresCrear.value.trim(),
      apellidos: apellidosCrear.value.trim(),
      fecha_nacimiento: fechaNacimientoCrear.value,
      sexo: sexoCrear.value,
      telefono: telefonoCrear.value.trim(),
      direccion: direccionCrear.value.trim(),
      representante: representanteCrear.value.trim(),
      telefono_representante: telefonoRepresentanteCrear.value.trim()
    };

    const { data, error } = await supabase.from("estudiantes").insert(payload).select().single();

    if (error) {
      alert("Error creando estudiante: " + error.message);
      return;
    }

    bootstrap.Modal.getInstance("#modalCrearEstudiante").hide();
    await cargarEstudiantes();
  }, 'Guardando...');
});
