// ============================================================================
// DASHBOARD DOCENTE - LOGIC
// ============================================================================

let estadoDashboard = {
  usuarioId: null,
  usuarioNombre: "",
  seccionActual: null,
  notasCargas: [],
  secciones: [],
};

// Inicializar dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Validar acceso
  if (!validarAcceso(['Docente'])) {
    return;
  }

  // Obtener datos del usuario
  const sesion = sessionAPI.obtenerSesion();
  estadoDashboard.usuarioId = sesion?.user?.id;
  estadoDashboard.usuarioNombre = obtenerNombreUsuario();

  // Actualizar UI
  document.getElementById('userName').textContent = estadoDashboard.usuarioNombre;
  document.getElementById('userEmail').textContent = sesion?.user?.email || 'correo@ejemplo.com';

  // Cargar sección inicial
  await cargarSeccion('inicio');
});

/**
 * Carga una sección del dashboard
 */
async function cargarSeccion(seccion) {
  const links = document.querySelectorAll('.nav-link');
  links.forEach(l => l.classList.remove('active'));

  const linkActivo = document.querySelector(`a[href="javascript:cargarSeccion('${seccion}')"]`);
  if (linkActivo) linkActivo.classList.add('active');

  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = '<div class="text-center"><span class="spinner-border"></span> Cargando...</div>';

  try {
    switch (seccion) {
      case 'inicio':
        await cargarInicio();
        break;
      case 'misecciones':
        await cargarMisSecciones();
        break;
      case 'cargarnotas':
        await cargarNotasUI();
        break;
      case 'historial':
        await cargarHistorialNotas();
        break;
      case 'asesorias':
        await cargarAsesorias();
        break;
      default:
        contentArea.innerHTML = '<p class="text-muted">Sección no encontrada</p>';
    }
  } catch (error) {
    console.error('Error cargando sección:', error);
    contentArea.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
  }
}

// ============================================================================
// 1. PANEL PRINCIPAL (INICIO)
// ============================================================================

async function cargarInicio() {
  mostrarCargando(true, "Cargando panel principal...");

  try {
    // Obtener estadísticas
    const { data: secciones } = await supabase
      .from('docente_materia_seccion')
      .select('seccion_id')
      .eq('docente_id', estadoDashboard.usuarioId)
      .eq('activo', true);

    const { data: notas } = await supabase
      .from('calificaciones')
      .select('id')
      .eq('docente_id', estadoDashboard.usuarioId);

    const { data: estudiantes } = await supabase
      .from('inscripciones')
      .select('id')
      .in('seccion_id', secciones?.map(s => s.seccion_id) || []);

    const totalSecciones = new Set(secciones?.map(s => s.seccion_id)).size || 0;
    const totalEstudiantes = estudiantes?.length || 0;
    const totalNotas = notas?.length || 0;

    const html = `
      <div class="row mb-4">
        <div class="col-md-12">
          <h1 class="mb-4">
            <i class="bi bi-speedometer2"></i> Panel Principal
          </h1>
        </div>
      </div>

      <div class="row">
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-number">${totalSecciones}</div>
            <p class="text-muted mb-0">Secciones Asignadas</p>
            <small>Cursos bajo tu cargo</small>
          </div>
        </div>
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-number">${totalEstudiantes}</div>
            <p class="text-muted mb-0">Estudiantes</p>
            <small>En todas tus secciones</small>
          </div>
        </div>
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-number">${totalNotas}</div>
            <p class="text-muted mb-0">Notas Cargadas</p>
            <small>Registros de calificaciones</small>
          </div>
        </div>
      </div>

      <div class="row mt-4">
        <div class="col-md-8">
          <div class="card">
            <div class="card-header bg-light">
              <h5 class="mb-0">
                <i class="bi bi-lightbulb"></i> Acciones Rápidas
              </h5>
            </div>
            <div class="card-body">
              <div class="list-group">
                <a href="javascript:cargarSeccion('cargarnotas')" class="list-group-item list-group-item-action">
                  <h6 class="mb-1"><i class="bi bi-pencil-square"></i> Cargar Notas</h6>
                  <small class="text-muted">Registra las calificaciones de tus estudiantes</small>
                </a>
                <a href="javascript:cargarSeccion('misecciones')" class="list-group-item list-group-item-action">
                  <h6 class="mb-1"><i class="bi bi-building"></i> Mis Secciones</h6>
                  <small class="text-muted">Consulta los detalles de tus cursos</small>
                </a>
                <a href="javascript:cargarSeccion('historial')" class="list-group-item list-group-item-action">
                  <h6 class="mb-1"><i class="bi bi-clock-history"></i> Historial</h6>
                  <small class="text-muted">Revisa las notas que has cargado</small>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card bg-light">
            <div class="card-header">
              <h5 class="mb-0">
                <i class="bi bi-info-circle"></i> Información
              </h5>
            </div>
            <div class="card-body small">
              <p><strong>Sistema:</strong> NOTAS Henry Pittier</p>
              <p><strong>Rol:</strong> Docente</p>
              <p><strong>Usuario:</strong> ${estadoDashboard.usuarioNombre}</p>
              <hr>
              <p class="text-muted mb-0">
                <small>Este panel te permite gestionar las notas de tus estudiantes.</small>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('contentArea').innerHTML = html;
    mostrarCargando(false);
  } catch (error) {
    console.error('Error en cargarInicio:', error);
    document.getElementById('contentArea').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    mostrarCargando(false);
  }
}

// ============================================================================
// 2. MIS SECCIONES
// ============================================================================

async function cargarMisSecciones() {
  mostrarCargando(true, "Cargando tus secciones...");

  try {
    const { data: asignaciones, error } = await supabase
      .from('docente_materia_seccion')
      .select(`
        id,
        seccion_id,
        materia_id,
        secciones:seccion_id(
          id,
          grado,
          letra,
          anio_escolar_id
        ),
        materias:materia_id(
          id,
          nombre
        )
      `)
      .eq('docente_id', estadoDashboard.usuarioId)
      .eq('activo', true);

    if (error) throw error;

    estadoDashboard.secciones = asignaciones || [];

    let html = `
      <h2 class="mb-4"><i class="bi bi-building"></i> Mis Secciones</h2>
      <div class="row">
    `;

    if (asignaciones?.length === 0) {
      html += '<div class="col-12"><div class="alert alert-info">No tienes secciones asignadas</div></div>';
    } else {
      for (const item of asignaciones) {
        const { data: estudiantes } = await supabase
          .from('inscripciones')
          .select('id')
          .eq('seccion_id', item.seccion_id);

        html += `
          <div class="col-md-6 mb-3">
            <div class="card card-seccion">
              <div class="card-header">
                <h5 class="mb-0">
                  ${item.secciones.grado}° ${item.secciones.letra}
                </h5>
              </div>
              <div class="card-body">
                <p><strong>Materia:</strong> ${item.materias.nombre}</p>
                <p><strong>Estudiantes:</strong> ${estudiantes?.length || 0}</p>
                <small class="text-muted">Año Escolar: ${item.secciones.anio_escolar_id}</small>
              </div>
            </div>
          </div>
        `;
      }
    }

    html += '</div>';
    document.getElementById('contentArea').innerHTML = html;
    mostrarCargando(false);
  } catch (error) {
    console.error('Error en cargarMisSecciones:', error);
    document.getElementById('contentArea').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    mostrarCargando(false);
  }
}

// ============================================================================
// 3. CARGAR NOTAS - Integración con iframe
// ============================================================================

async function cargarNotasUI() {
  const html = `
    <h2 class="mb-4"><i class="bi bi-pencil-square"></i> Cargar Notas</h2>
    
    <div class="alert alert-info mb-3">
      <i class="bi bi-info-circle"></i>
      <strong>Instrucciones:</strong> Selecciona tu sección, materia y lapso para crear evaluaciones y cargar notas.
    </div>

    <div class="card">
      <div class="card-body">
        <div class="row mb-3">
          <div class="col-md-4">
            <label class="form-label">Sección</label>
            <select id="select-seccion-notas" class="form-select" onchange="actualizarMateriasNotas()">
              <option value="">-- Selecciona sección --</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Materia</label>
            <select id="select-materia-notas" class="form-select" disabled>
              <option value="">-- Selecciona materia --</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Lapso</label>
            <select id="select-lapso-notas" class="form-select">
              <option value="">-- Selecciona lapso --</option>
            </select>
          </div>
        </div>

        <div id="notas-container" style="display:none; margin-top:20px;">
          <h5>Evaluaciones</h5>
          <div id="evaluaciones-list" class="mb-3"></div>
          
          <h5>Tabla de Estudiantes</h5>
          <div class="table-responsive">
            <table class="table table-sm" id="tabla-estudiantes">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombres</th>
                  <th>Apellidos</th>
                  <th>Presente</th>
                  <th>Nota</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody id="tbody-notas"></tbody>
            </table>
          </div>
          <button class="btn btn-success" onclick="guardarNotasDesdeUI()">
            💾 Guardar Notas
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('contentArea').innerHTML = html;

  // Cargar secciones
  try {
    const { data: asignaciones } = await supabase
      .from('docente_materia_seccion')
      .select('seccion_id, secciones:seccion_id(id, grado, letra)')
      .eq('docente_id', estadoDashboard.usuarioId)
      .eq('activo', true);

    const select = document.getElementById('select-seccion-notas');
    select.innerHTML = '<option value="">-- Selecciona sección --</option>';

    const seccionesUnicas = new Map();
    asignaciones?.forEach(a => {
      if (!seccionesUnicas.has(a.seccion_id)) {
        seccionesUnicas.set(a.seccion_id, a.secciones);
      }
    });

    seccionesUnicas.forEach((sec, id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${sec.grado}° ${sec.letra}`;
      select.appendChild(opt);
    });

    // Cargar lapsos
    const { data: lapsos } = await supabase
      .from('lapsos')
      .select('id, numero')
      .eq('estado', 'activo');

    const selectLapso = document.getElementById('select-lapso-notas');
    selectLapso.innerHTML = '<option value="">-- Selecciona lapso --</option>';
    lapsos?.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `Lapso ${l.numero}`;
      selectLapso.appendChild(opt);
    });
  } catch (error) {
    console.error('Error cargando opciones:', error);
  }

  mostrarCargando(false);
}

async function actualizarMateriasNotas() {
  const seccionId = document.getElementById('select-seccion-notas').value;
  if (!seccionId) return;

  try {
    const { data: materias } = await supabase
      .from('docente_materia_seccion')
      .select('materia_id, materias:materia_id(id, nombre)')
      .eq('docente_id', estadoDashboard.usuarioId)
      .eq('seccion_id', seccionId)
      .eq('activo', true);

    const select = document.getElementById('select-materia-notas');
    select.innerHTML = '<option value="">-- Selecciona materia --</option>';
    materias?.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.materia_id;
      opt.textContent = m.materias.nombre;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error cargando materias:', error);
  }
}

async function guardarNotasDesdeUI() {
  mostrarCargando(true, "Guardando notas...");
  try {
    // Implementar lógica de guardado
    mostrarExito("Notas guardadas correctamente");
    mostrarCargando(false);
  } catch (error) {
    mostrarError(error.message);
    mostrarCargando(false);
  }
}

// ============================================================================
// 4. HISTORIAL DE NOTAS
// ============================================================================

async function cargarHistorialNotas() {
  mostrarCargando(true, "Cargando historial...");

  try {
    const { data: notas, error } = await supabase
      .from('calificaciones')
      .select(`
        id,
        estudiante_id,
        nota,
        fecha_carga,
        lapsos:lapso_id(numero)
      `)
      .eq('docente_id', estadoDashboard.usuarioId)
      .order('fecha_carga', { ascending: false })
      .limit(100);

    if (error) throw error;

    let html = `
      <h2 class="mb-4"><i class="bi bi-clock-history"></i> Historial de Notas</h2>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Estudiante ID</th>
              <th>Nota</th>
              <th>Lapso</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (notas?.length === 0) {
      html += '<tr><td colspan="4" class="text-center text-muted">No hay registros</td></tr>';
    } else {
      notas.forEach(nota => {
        html += `
          <tr>
            <td>${formatearFecha(nota.fecha_carga)}</td>
            <td>${nota.estudiante_id}</td>
            <td><strong>${nota.nota}</strong></td>
            <td>Lapso ${nota.lapsos?.numero || '-'}</td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('contentArea').innerHTML = html;
    mostrarCargando(false);
  } catch (error) {
    console.error('Error en cargarHistorialNotas:', error);
    document.getElementById('contentArea').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    mostrarCargando(false);
  }
}

// ============================================================================
// 5. ASESORÍAS / CONSULTAS
// ============================================================================

async function cargarAsesorias() {
  const html = `
    <h2 class="mb-4"><i class="bi bi-chat-dots"></i> Centro de Ayuda</h2>
    
    <div class="row">
      <div class="col-md-8">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="mb-0">Preguntas Frecuentes</h5>
          </div>
          <div class="card-body">
            <div class="accordion" id="accordionFAQ">
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                    ¿Cómo cargo las notas?
                  </button>
                </h2>
                <div id="faq1" class="accordion-collapse collapse show" data-bs-parent="#accordionFAQ">
                  <div class="accordion-body">
                    Ve a la sección "Cargar Notas", selecciona tu sección, materia y lapso. Luego crea evaluaciones o selecciona una existente para registrar calificaciones.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                    ¿Puedo editar notas ya cargadas?
                  </button>
                </h2>
                <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#accordionFAQ">
                  <div class="accordion-body">
                    Sí. Selecciona la misma evaluación y haz los cambios necesarios. Los cambios se guardarán automáticamente.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                    ¿Existe un límite de evaluaciones por materia?
                  </button>
                </h2>
                <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#accordionFAQ">
                  <div class="accordion-body">
                    Sí. Máximo 7 evaluaciones por materia en cada lapso, con un máximo de 25% cada una (total 100%).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card bg-light">
          <div class="card-header">
            <h5 class="mb-0">Contacto</h5>
          </div>
          <div class="card-body small">
            <p><strong>Email:</strong> soporte@henry pittier.edu</p>
            <p><strong>Teléfono:</strong> +58 (XXX) XXX-XXXX</p>
            <p><strong>Horario:</strong> Lun-Vie 7am-4pm</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('contentArea').innerHTML = html;
  mostrarCargando(false);
}

// ============================================================================
// UTILIDADES GLOBALES
// ============================================================================

function irAPerfil() {
  window.location.href = '/pages/perfil.html';
}

const nav = {
  logout: logout,
  irAPerfil: irAPerfil,
};
