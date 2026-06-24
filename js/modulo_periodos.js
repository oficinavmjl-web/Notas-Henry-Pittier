let tokenPeriodos = null;

// -------------------------------------------------------------
// Cargar módulo
// -------------------------------------------------------------
async function cargarModuloPeriodos(token) {
  tokenPeriodos = token;

  document.getElementById("tituloModulo").textContent = "Períodos Académicos";

  document.getElementById("moduloContenido").innerHTML = `
    <div class="d-flex justify-content-between mb-3">
      <h4>Años Escolares</h4>
      <button class="btn btn-primary" onclick="abrirModalCrearAnio()">+ Crear Año Escolar</button>
    </div>

    <div id="listaAnios"></div>

    <!-- Modal Crear Año -->
    <div class="modal fade" id="modalCrearAnio" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Crear Año Escolar</h5>
            <button class="btn-close" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <form id="formCrearAnio">
              <div class="mb-3">
                <label>Nombre del Año</label>
                <input id="anioNombre" class="form-control" placeholder="Ej: 2024-2025" required>
              </div>

              <div class="mb-3">
                <label>Fecha Inicio</label>
                <input id="anioInicio" type="date" class="form-control" required>
              </div>

              <div class="mb-3">
                <label>Fecha Fin</label>
                <input id="anioFin" type="date" class="form-control" required>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button id="btnCrearAnio" class="btn btn-primary">Crear</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear Lapso -->
    <div class="modal fade" id="modalCrearLapso" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Crear Lapso</h5>
            <button class="btn-close" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <form id="formCrearLapso">
              <input type="hidden" id="lapsoAnioId">

              <div class="mb-3">
                <label>Nombre del Lapso</label>
                <input id="lapsoNombre" class="form-control" placeholder="Ej: Primer Lapso" required>
              </div>

              <div class="mb-3">
                <label>Fecha Inicio</label>
                <input id="lapsoInicio" type="date" class="form-control" required>
              </div>

              <div class="mb-3">
                <label>Fecha Fin</label>
                <input id="lapsoFin" type="date" class="form-control" required>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button id="btnCrearLapso" class="btn btn-primary">Crear</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach handlers to prevent doble envío
  setTimeout(() => {
    const btnAnio = document.getElementById('btnCrearAnio');
    if (btnAnio) btnAnio.addEventListener('click', async () => await runAsyncWithButton(btnAnio, crearAnio, 'Creando...'));

    const btnLapso = document.getElementById('btnCrearLapso');
    if (btnLapso) btnLapso.addEventListener('click', async () => await runAsyncWithButton(btnLapso, crearLapso, 'Creando...'));
  }, 50);

  cargarAnios();
}

// -------------------------------------------------------------
// Listar años escolares
// -------------------------------------------------------------
async function cargarAnios() {
  const { data, error } = await supabase.functions.invoke(
    "periodos-list_anios",
    {
      body: {},
      headers: { Authorization: `Bearer ${tokenPeriodos}` }
    }
  );

  if (error) {
    document.getElementById("listaAnios").innerHTML =
      `<div class="alert alert-danger">Error cargando años escolares</div>`;
    return;
  }

  let html = `<div class="list-group">`;

  data.data.forEach(anio => {
    html += `
      <div class="list-group-item">
        <div class="d-flex justify-content-between">
          <div>
            <strong>${anio.nombre}</strong><br>
            <small>${anio.fecha_inicio} → ${anio.fecha_fin}</small><br>
            ${anio.activo ? `<span class="badge bg-success">Activo</span>` : ""}
          </div>

          <div>
            <button class="btn btn-sm btn-info" onclick="verLapsos(${anio.id_anio})">Lapsos</button>
            ${
              anio.activo
                ? `<button class="btn btn-sm btn-danger" onclick="cerrarAnio(${anio.id_anio})">Cerrar Año</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  document.getElementById("listaAnios").innerHTML = html;
}

// -------------------------------------------------------------
// Crear año escolar
// -------------------------------------------------------------
function abrirModalCrearAnio() {
  document.getElementById("formCrearAnio").reset();
  new bootstrap.Modal(document.getElementById("modalCrearAnio")).show();
}

async function crearAnio() {
  const nombre = document.getElementById("anioNombre").value.trim();
  const inicio = document.getElementById("anioInicio").value;
  const fin = document.getElementById("anioFin").value;

  await supabase.functions.invoke("periodos-create_anio", {
    body: {
      nombre,
      fecha_inicio: inicio,
      fecha_fin: fin
    },
    headers: { Authorization: `Bearer ${tokenPeriodos}` }
  });

  bootstrap.Modal.getInstance(document.getElementById("modalCrearAnio")).hide();
  cargarAnios();
}

// -------------------------------------------------------------
// Cerrar año escolar
// -------------------------------------------------------------
async function cerrarAnio(id) {
  await supabase.functions.invoke("periodos-close_anio", {
    body: { id_anio: id },
    headers: { Authorization: `Bearer ${tokenPeriodos}` }
  });

  cargarAnios();
}

// -------------------------------------------------------------
// Ver lapsos de un año
// -------------------------------------------------------------
async function verLapsos(id_anio) {
  const { data, error } = await supabase.functions.invoke(
    "periodos-list_lapsos",
    {
      body: { id_anio },
      headers: { Authorization: `Bearer ${tokenPeriodos}` }
    }
  );

  if (error) return alert("Error cargando lapsos");

  let html = `
    <h4 class="mt-4">Lapsos</h4>
    <button class="btn btn-primary mb-3" onclick="abrirModalCrearLapso(${id_anio})">+ Crear Lapso</button>
    <div class="list-group">
  `;

  data.data.forEach(lapso => {
    html += `
      <div class="list-group-item">
        <div class="d-flex justify-content-between">
          <div>
            <strong>${lapso.nombre}</strong><br>
            <small>${lapso.fecha_inicio} → ${lapso.fecha_fin}</small><br>
            ${lapso.activo ? `<span class="badge bg-success">Activo</span>` : ""}
          </div>

          <div>
            ${
              !lapso.activo
                ? `<button class="btn btn-sm btn-success" onclick="activarLapso(${lapso.id_lapso})">Activar</button>`
                : ""
            }
            <button class="btn btn-sm btn-danger" onclick="cerrarLapso(${lapso.id_lapso})">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;

  document.getElementById("listaAnios").innerHTML += html;
}

// -------------------------------------------------------------
// Crear lapso
// -------------------------------------------------------------
function abrirModalCrearLapso(id_anio) {
  document.getElementById("lapsoAnioId").value = id_anio;
  document.getElementById("formCrearLapso").reset();
  new bootstrap.Modal(document.getElementById("modalCrearLapso")).show();
}

async function crearLapso() {
  const id_anio = document.getElementById("lapsoAnioId").value;
  const nombre = document.getElementById("lapsoNombre").value.trim();
  const inicio = document.getElementById("lapsoInicio").value;
  const fin = document.getElementById("lapsoFin").value;

  await supabase.functions.invoke("periodos-create_lapso", {
    body: {
      id_anio,
      nombre,
      fecha_inicio: inicio,
      fecha_fin: fin
    },
    headers: { Authorization: `Bearer ${tokenPeriodos}` }
  });

  bootstrap.Modal.getInstance(document.getElementById("modalCrearLapso")).hide();
  cargarAnios();
}

// -------------------------------------------------------------
// Activar lapso
// -------------------------------------------------------------
async function activarLapso(id_lapso) {
  await supabase.functions.invoke("periodos-activate_lapso", {
    body: { id_lapso },
    headers: { Authorization: `Bearer ${tokenPeriodos}` }
  });

  cargarAnios();
}

// -------------------------------------------------------------
// Cerrar lapso
// -------------------------------------------------------------
async function cerrarLapso(id_lapso) {
  await supabase.functions.invoke("periodos-close_lapso", {
    body: { id_lapso },
    headers: { Authorization: `Bearer ${tokenPeriodos}` }
  });

  cargarAnios();
}
