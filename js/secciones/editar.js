function abrirEditar(idSeccion) {
  limpiarErrores(); // ← IMPORTANTE

  const sec = window._secciones.find(s => s.id_seccion === idSeccion);
  if (!sec) return;

  document.getElementById("editarIdSeccion").value = sec.id_seccion;
  document.getElementById("editarNombre").value = sec.nombre;
  document.getElementById("editarGrado").value = sec.grado;
  document.getElementById("editarLetra").value = sec.letra;
  document.getElementById("editarAnio").value = sec.anio_escolar_id;

  new bootstrap.Modal(document.getElementById("modalEditar")).show();
}

async function guardarEdicionSeccion(event) {
  const btn = event.target;
  btn.disabled = true;

  const error = validarEditar();
  if (error) {
    alert(error);
    btn.disabled = false;
    return;
  }

  const body = {
    id_seccion: Number(document.getElementById("editarIdSeccion").value),
    nombre: document.getElementById("editarNombre").value,
    grado: Number(document.getElementById("editarGrado").value),
    letra: document.getElementById("editarLetra").value,
    anio_escolar_id: Number(document.getElementById("editarAnio").value)
  };

  try {
    const data = await API.secciones.editar(body.id_seccion, body);

    if (data?.error) {
      alert("Error: " + data.error);
      return;
    }

    cargarSecciones();

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalEditar"));
    modal.hide();

  } finally {
    btn.disabled = false;
  }
}

function toggleSeccion(idSeccion) {
  const sec = window._secciones.find(s => s.id_seccion === idSeccion);
  if (!sec) return;

  const accion = sec.activo ? "desactivar" : "activar";

  confirmarAccion(
    `¿Seguro que deseas ${accion} la sección "${sec.nombre}"?`,
    async () => {
      const data = await API.secciones.toggle(idSeccion);

      if (data?.error) {
        alert("Error: " + data.error);
        return;
      }

      cargarSecciones();
    }
  );
}
