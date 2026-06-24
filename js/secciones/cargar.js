// Cargar años escolares en los selects


async function cargarAniosEscolares() {
  try {
    const data = await API.periodos.listarAnios();
    const items = Array.isArray(data) ? data : data?.data || [];

  const selects = [
    document.getElementById("filtroAnio"),
    document.getElementById("crearAnio"),
    document.getElementById("editarAnio")
  ];

    selects.forEach(sel => {
      sel.innerHTML = "";
      items.forEach(a => {
        sel.innerHTML += `<option value="${a.id_anio}">${a.nombre}</option>`;
      });
    });
  } catch (error) {
    console.error("Error al cargar años escolares", error);
  }
}

// Cargar secciones
async function cargarSecciones() {
  const anio = document.getElementById("filtroAnio").value;

  try {
    const data = await API.secciones.listar({ anio_escolar_id: anio });
    const items = Array.isArray(data) ? data : data?.items || data?.secciones || [];

    // Guardar en memoria
    window._secciones = items;
    window._seccionesFiltradas = [...items];
    renderizarTabla();

    const tbody = document.getElementById("tablaSecciones");
    tbody.innerHTML = "";

    items.forEach(sec => {
    tbody.innerHTML += `
      <tr>
        <td>${sec.nombre}</td>
        <td>${sec.grado}</td>
        <td>${sec.letra}</td>
        <td>
          <span class="badge ${sec.activo ? "bg-success" : "bg-danger"}">
            ${sec.activo ? "Activa" : "Inactiva"}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-info" onclick="abrirMaterias(${sec.id_seccion})">
            Materias
          </button>

          <button class="btn btn-sm btn-warning" onclick="abrirEditar(${sec.id_seccion})">
            Editar
          </button>

          <button class="btn btn-sm btn-secondary" onclick="abrirClonar(${sec.id_seccion})">
            Clonar
          </button>

          <button class="btn btn-sm btn-dark" onclick="toggleSeccion(${sec.id_seccion})">
            ${sec.activo ? "Desactivar" : "Activar"}
          </button>
        </td>
      </tr>
    `;
  });
}

function renderizarTabla() {
  const tbody = document.getElementById("tablaSecciones");
  tbody.innerHTML = "";

  const inicio = (window._paginaActual - 1) * window._tamanoPagina;
  const fin = inicio + window._tamanoPagina;

  const pagina = window._seccionesFiltradas.slice(inicio, fin);

  pagina.forEach(sec => {
    tbody.innerHTML += `
      <tr>
        <td>${sec.nombre}</td>
        <td>${sec.grado}</td>
        <td>${sec.letra}</td>
        <td>
          <span class="badge ${sec.activo ? "bg-success" : "bg-danger"}">
            ${sec.activo ? "Activa" : "Inactiva"}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-info" onclick="abrirMaterias(${sec.id_seccion})">Materias</button>
          <button class="btn btn-sm btn-warning" onclick="abrirEditar(${sec.id_seccion})">Editar</button>
          <button class="btn btn-sm btn-secondary" onclick="abrirClonar(${sec.id_seccion})">Clonar</button>
          <button class="btn btn-sm btn-dark" onclick="toggleSeccion(${sec.id_seccion})">
            ${sec.activo ? "Desactivar" : "Activar"}
          </button>
        </td>
      </tr>
    `;
  });

  renderizarPaginacion(window._seccionesFiltradas.length);
}
