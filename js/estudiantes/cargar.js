async function cargarFiltrosEstudiantes() {
  await cargarAniosEscolares();
  await cargarGrados();
  await cargarSecciones();
}

async function cargarEstudiantes() {
  const filtros = {
    buscar: document.getElementById("buscarEstudiante").value.trim(),
    anio_escolar_id: document.getElementById("filtroAnioEscolar").value || null,
    grado_id: document.getElementById("filtroGrado").value || null,
    seccion_id: document.getElementById("filtroSeccion").value || null,
    estado: document.getElementById("filtroEstado").value || null,
    ordenar_por: window._ordenarPor,
    direccion: window._direccionOrden,
    pagina: window._paginaActual,
    limite: window._tamanoPagina
  };

  try {
    const data = await API.estudiantes.listar(filtros);
    const estudiantes = Array.isArray(data?.estudiantes) ? data.estudiantes : Array.isArray(data) ? data : [];
    const total = data?.total || estudiantes.length;

    window._estudiantes = estudiantes;
    renderizarTablaEstudiantes();
    renderizarPaginacionEstudiantes(total);
  } catch (error) {
    console.error("Error listando estudiantes:", error);
  }
}

function renderizarTablaEstudiantes() {
  const tbody = document.getElementById("tablaEstudiantes");
  tbody.innerHTML = "";

  if (!window._estudiantes || window._estudiantes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          No se encontraron estudiantes.
        </td>
      </tr>`;
    return;
  }

  window._estudiantes.forEach(est => {

    // ============================
    // Cálculo de edad
    // ============================
    let edad = "";
    if (est.fecha_nacimiento) {
      const nacimiento = new Date(est.fecha_nacimiento);
      const hoy = new Date();
      edad = hoy.getFullYear() - nacimiento.getFullYear();
      const m = hoy.getMonth() - nacimiento.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
      }
    }

    // ============================
    // Badge de estado
    // ============================
    const badgeEstado = est.activo
      ? `<span class="badge bg-success">Activo</span>`
      : `<span class="badge bg-secondary">Inactivo</span>`;

    // ============================
    // Inscripción activa (si existe)
    // ============================
    let idInscripcionActiva = null;

    if (est.inscripciones && est.inscripciones.length > 0) {
      const activa = est.inscripciones.find(i => i.estado === "activo");
      if (activa) idInscripcionActiva = activa.id_inscripcion;
    }

    // ============================
    // Botones de acción
    // ============================
    const btnDetalles = `
      <button class="btn btn-sm btn-info me-1"
        onclick="abrirDetallesEstudiante(${est.id_estudiante})">
        Detalles
      </button>`;

    const btnEditar = `
      <button class="btn btn-sm btn-primary me-1"
        onclick="abrirEditarEstudiante(${est.id_estudiante})">
        Editar
      </button>`;

    const btnRetirar = idInscripcionActiva
      ? `
        <button class="btn btn-sm btn-danger"
          onclick="retirarEstudiante(${idInscripcionActiva})">
          Retirar
        </button>`
      : `
        <button class="btn btn-sm btn-secondary" disabled>
          Sin inscripción
        </button>`;

    // ============================
    // Render fila
    // ============================
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${est.cedula}</td>
      <td>${est.apellidos}, ${est.nombres}</td>
      <td>${edad || "-"}</td>
      <td>${est.sexo || "-"}</td>
      <td>${badgeEstado}</td>
      <td>${btnDetalles}${btnEditar}${btnRetirar}</td>
    `;

    tbody.appendChild(tr);
  });
}
