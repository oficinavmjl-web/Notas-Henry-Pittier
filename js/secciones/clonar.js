
function abrirClonar(idSeccion) {
  limpiarErrores(); // ← IMPORTANTE

  const sec = window._secciones.find(s => s.id_seccion === idSeccion);
  if (!sec) return;

  document.getElementById("clonarIdSeccion").value = sec.id_seccion;

  document.getElementById("clonarInfoOrigen").innerText =
    `Origen: ${sec.nombre} — ${sec.grado}° ${sec.letra}`;

  document.getElementById("clonarNombre").value = sec.nombre;
  document.getElementById("clonarLetra").value = "";

  new bootstrap.Modal(document.getElementById("modalClonar")).show();
}

async function ejecutarClonado(event) {
  const btn = event.target;
  btn.disabled = true;

  const error = validarClonar();
  if (error) {
    alert(error);
    btn.disabled = false;
    return;
  }

  const body = {
    id_seccion_origen: Number(document.getElementById("clonarIdSeccion").value),
    nombre_nuevo: document.getElementById("clonarNombre").value,
    letra_nueva: document.getElementById("clonarLetra").value
  };

  try {
    const data = await API.secciones.clonarAOtroAnio(
      body.id_seccion_origen,
      body.anio_destino || null
    );

    if (data?.error) {
      alert("Error: " + data.error);
      return;
    }

    cargarSecciones();

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalClonar"));
    modal.hide();

  } finally {
    btn.disabled = false;
  }
}