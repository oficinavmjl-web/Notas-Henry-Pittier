
async function abrirAsignarDocente(idSeccion, idMateria) {
  limpiarErrores(); // ← IMPORTANTE

  document.getElementById("asignarIdSeccion").value = idSeccion;
  document.getElementById("asignarIdMateria").value = idMateria;

  const materia = window._materiasSeccion?.find(m => m.id_materia === idMateria);

  document.getElementById("asignarInfoMateria").innerText =
    materia ? `Materia: ${materia.nombre_materia}` : "Materia seleccionada";

  const { data: rawDocentes, error: docentesError } = await supabase.functions.invoke(
    "users-list_users",
    {
      body: {
        page: 1,
        per_page: 200,
        rol_filter: "docente",
        activo_filter: true
      },
      headers: { Authorization: `Bearer ${session.access_token}` }
    }
  );

  if (docentesError) {
    alert("Error cargando docentes");
    return;
  }

  const response = JSON.parse(rawDocentes);
  const docentes = response.items || [];

  const select = document.getElementById("asignarDocenteSelect");
  select.innerHTML = "";

  docentes.forEach(doc => {
    select.innerHTML += `
      <option value="${doc.id}">
        ${doc.nombres || ""} ${doc.apellidos || ""}
      </option>
    `;
  });

  new bootstrap.Modal(document.getElementById("modalAsignarDocente")).show();
}

async function guardarAsignacionDocente(event) {
  const btn = event.target;
  btn.disabled = true;

  const error = validarAsignarDocente();
  if (error) {
    alert(error);
    btn.disabled = false;
    return;
  }
  
  const body = {
    id_seccion: Number(document.getElementById("asignarIdSeccion").value),
    id_materia: Number(document.getElementById("asignarIdMateria").value),
    id_docente: Number(document.getElementById("asignarDocenteSelect").value)
  };

  try {
    const data = await API.secciones.asignarDocente(body.id_seccion, body.id_materia, body.id_docente);

    if (data?.error) {
      alert("Error: " + data.error);
      return;
    }

    abrirMaterias(body.id_seccion);

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalAsignarDocente"));
    modal.hide();

  } finally {
    btn.disabled = false;
  }
}