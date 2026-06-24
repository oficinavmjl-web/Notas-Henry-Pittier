// ============================================================================
// MÓDULO: CARGA DE NOTAS - DOCENTE
// ============================================================================
// Este módulo maneja la creación de evaluaciones y carga de notas por docente

// Estado de la aplicación
let estadoApp = {
  usuarioId: null,
  seccionActual: null,
  lapsoActual: null,
  materiaActual: null,
  evaluacionActual: null,
  estudiantesEnSeccion: [],
  evaluacionesMateria: [],
  ventanaAbierta: false,
  notasBuffer: {} // Buffer temporal para notas antes de guardar
};

// ============================================================================
// 1. INICIALIZACIÓN
// ============================================================================

document.addEventListener("DOMContentLoaded", async function() {
  // Verificar autenticación y rol
  if (!validarAcceso(["Docente"])) {
    window.location.href = "/pages/login.html";
    return;
  }

  const sesion = obtenerSesionUsuario();
  estadoApp.usuarioId = sesion.user_id;

  // Mostrar datos de usuario
  document.getElementById("usuario-nombre").textContent = obtenerNombreUsuario();

  // Cargar secciones del docente
  await cargarSeccionesDocente();

  // Cargar lapsos activos
  await cargarLapsosActivos();

  // Configurar event listeners
  configurarEventListeners();
});

// ============================================================================
// 2. CARGAR SECCIONES
// ============================================================================

async function cargarSeccionesDocente() {
  mostrarCargando(true, "Cargando tus secciones...");

  try {
    const { data, error } = await supabase
      .from("docente_materia_seccion")
      .select(`
        id,
        seccion_id,
        lapso_id,
        materia_id,
        secciones (
          id,
          grado,
          letra,
          anio_escolar_id
        ),
        materias (
          id,
          nombre
        ),
        lapsos (
          id,
          numero,
          anio_id,
          estado
        )
      `)
      .eq("docente_id", estadoApp.usuarioId)
      .eq("activo", true);

    if (error) throw error;

    // Agrupar por sección
    const seccionesMap = {};
    data?.forEach(item => {
      const secId = item.seccion_id;
      if (!seccionesMap[secId]) {
        seccionesMap[secId] = item.secciones;
        seccionesMap[secId].materias = [];
      }
      seccionesMap[secId].materias.push({
        id: item.materia_id,
        nombre: item.materias.nombre,
        lapso_id: item.lapso_id
      });
    });

    // Mostrar secciones
    const seccionesContainer = document.getElementById("secciones-list");
    seccionesContainer.innerHTML = "";

    Object.values(seccionesMap).forEach((seccion) => {
      const html = `
        <button class="list-group-item list-group-item-action text-start" 
                onclick="seleccionarSeccion(${seccion.id})">
          <strong>${seccion.grado}° ${seccion.letra}</strong>
          <br>
          <small class="text-muted">
            ${seccion.materias.length} materia(s)
          </small>
        </button>
      `;
      seccionesContainer.insertAdjacentHTML("beforeend", html);
    });

    if (Object.keys(seccionesMap).length === 0) {
      seccionesContainer.innerHTML = `
        <div class="list-group-item text-muted text-center py-3">
          <small>No tienes secciones asignadas</small>
        </div>
      `;
    }

    mostrarCargando(false);
  } catch (error) {
    console.error("Error cargando secciones:", error);
    mostrarError("Error al cargar tus secciones");
    mostrarCargando(false);
  }
}

// ============================================================================
// 3. CARGAR LAPSOS ACTIVOS
// ============================================================================

async function cargarLapsosActivos() {
  try {
    const { data, error } = await supabase
      .from("lapsos")
      .select("id, numero, anio_id, estado, fecha_inicio, fecha_fin")
      .eq("estado", "activo")
      .order("numero", { ascending: true });

    if (error) throw error;

    const selectLapso = document.getElementById("select-lapso");
    selectLapso.innerHTML = '<option value="">-- Selecciona un lapso --</option>';

    data?.forEach(lapso => {
      const html = `<option value="${lapso.id}">Lapso ${lapso.numero}</option>`;
      selectLapso.insertAdjacentHTML("beforeend", html);
    });
  } catch (error) {
    console.error("Error cargando lapsos:", error);
  }
}

// ============================================================================
// 4. SELECCIONAR SECCIÓN
// ============================================================================

async function seleccionarSeccion(seccionId) {
  estadoApp.seccionActual = seccionId;
  mostrarCargando(true, "Cargando sección...");

  try {
    // Obtener información de la sección
    const { data: seccionData, error: secError } = await supabase
      .from("secciones")
      .select("id, grado, letra, anio_escolar_id")
      .eq("id", seccionId)
      .single();

    if (secError) throw secError;

    // Obtener estudiantes inscritos
    const { data: estudiantes, error: estError } = await supabase
      .from("inscripciones")
      .select(`
        id,
        estudiante_id,
        auth.users (
          id,
          email,
          user_metadata
        )
      `)
      .eq("seccion_id", seccionId);

    if (estError) throw estError;

    estadoApp.estudiantesEnSeccion = estudiantes?.map(e => ({
      id: e.estudiante_id,
      email: e.auth.users?.email,
      nombre: e.auth.users?.user_metadata?.nombre || "",
      apellido: e.auth.users?.user_metadata?.apellido || "",
      cedula: e.auth.users?.user_metadata?.cedula || ""
    })) || [];

    // Obtener materias de esta sección
    const { data: materias, error: matError } = await supabase
      .from("docente_materia_seccion")
      .select(`
        id,
        materia_id,
        lapso_id,
        materias (
          id,
          nombre
        )
      `)
      .eq("docente_id", estadoApp.usuarioId)
      .eq("seccion_id", seccionId)
      .eq("activo", true);

    if (matError) throw matError;

    // Llenar select de materias
    const selectMateria = document.getElementById("select-materia");
    selectMateria.innerHTML = '<option value="">-- Selecciona una materia --</option>';

    materias?.forEach(m => {
      const html = `<option value="${m.materia_id}" data-lapso-id="${m.lapso_id}">
        ${m.materias.nombre}
      </option>`;
      selectMateria.insertAdjacentHTML("beforeend", html);
    });

    document.getElementById("select-materia").disabled = false;

    mostrarExito(`Sección ${seccionData.grado}° ${seccionData.letra} seleccionada`, 2000);
    mostrarCargando(false);
  } catch (error) {
    console.error("Error seleccionando sección:", error);
    mostrarError("Error al cargar la sección");
    mostrarCargando(false);
  }
}

// ============================================================================
// 5. CARGAR EVALUACIONES Y MATERIAS
// ============================================================================

async function cargarEvaluacionesMateria() {
  const materiaId = document.getElementById("select-materia").value;
  const lapsoId = document.getElementById("select-lapso").value;

  if (!materiaId || !lapsoId || !estadoApp.seccionActual) {
    document.getElementById("evaluaciones-existentes").innerHTML = 
      '<p class="text-muted">Selecciona materia, lapso y sección para ver evaluaciones.</p>';
    return;
  }

  mostrarCargando(true, "Cargando evaluaciones...");

  try {
    estadoApp.materiaActual = materiaId;
    estadoApp.lapsoActual = lapsoId;

    const evaluaciones = await API.evaluaciones.listar({
      docente_id: estadoApp.usuarioId,
      seccion_id: estadoApp.seccionActual,
      materia_id: materiaId,
      lapso_id: lapsoId,
    });

    estadoApp.evaluacionesMateria = evaluaciones || [];

    // Mostrar evaluaciones
    mostrarEvaluacionesExistentes();

    // Mostrar resumen de porcentajes
    mostrarResumenPorcentajes();

    // Verificar ventana de carga
    verificarVentanaCarga(lapsoId);

    // Cargar tabla de estudiantes
    if (estadoApp.evaluacionesMateria.length > 0) {
      mostrarTablaEstudiantes(estadoApp.evaluacionesMateria[0].id);
      document.getElementById("card-estudiantes").style.display = "block";
    } else {
      document.getElementById("card-estudiantes").style.display = "none";
    }

    mostrarCargando(false);
  } catch (error) {
    console.error("Error cargando evaluaciones:", error);
    mostrarError("Error al cargar evaluaciones");
    mostrarCargando(false);
  }
}

// ============================================================================
// 6. MOSTRAR EVALUACIONES EXISTENTES
// ============================================================================

function mostrarEvaluacionesExistentes() {
  const container = document.getElementById("evaluaciones-existentes");

  if (estadoApp.evaluacionesMateria.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay evaluaciones creadas aún.</p>';
    return;
  }

  let html = "";
  estadoApp.evaluacionesMateria.forEach(eval => {
    const fecha = formatearFecha(eval.fecha);
    const clase = eval.id === estadoApp.evaluacionActual ? "activa" : "";
    
    html += `
      <div class="evaluacion-item ${clase}" onclick="seleccionarEvaluacion(${eval.id})">
        <div class="row align-items-center">
          <div class="col-md-6">
            <strong>${eval.nombre_evaluacion}</strong>
            <br>
            <small class="text-muted">
              📅 ${fecha} | 📊 ${eval.porcentaje}% | 📈 Máx: ${eval.valor_maximo} pts
            </small>
            <br>
            <small class="text-muted">
              🎯 ${eval.tipos_evaluacion?.nombre || "N/A"} - 
              📋 ${eval.instrumentos_evaluacion?.nombre || "N/A"}
            </small>
          </div>
          <div class="col-md-6 text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarEvaluacion(event, ${eval.id})">
              🗑️ Eliminar
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="editarEvaluacion(event, ${eval.id})">
              ✏️ Editar
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ============================================================================
// 7. CREAR NUEVA EVALUACIÓN
// ============================================================================

async function crearEvaluacion(event) {
  event.preventDefault();

  if (!estadoApp.seccionActual || !estadoApp.materiaActual || !estadoApp.lapsoActual) {
    mostrarError("Debes seleccionar sección, materia y lapso primero");
    return;
  }

  if (!estadoApp.ventanaAbierta) {
    mostrarError("La ventana de carga no está abierta para este lapso");
    return;
  }

  const nombre = document.getElementById("input-nombre-eval").value.trim();
  const fecha = document.getElementById("input-fecha-eval").value;
  const tipoEval = parseInt(document.getElementById("select-tipo-eval").value);
  const instrumento = parseInt(document.getElementById("select-instrumento-eval").value);
  const porcentaje = parseFloat(document.getElementById("input-porcentaje").value);
  const valorMaximo = parseFloat(document.getElementById("input-valor-maximo").value);
  const descripcion = document.getElementById("input-descripcion-eval").value;

  // Validaciones
  if (porcentaje > 25) {
    mostrarError("El porcentaje no puede superar el 25%");
    return;
  }

  // Verificar suma de porcentajes
  const sumaActual = estadoApp.evaluacionesMateria.reduce((sum, e) => sum + e.porcentaje, 0);
  const nuevaSuma = sumaActual + porcentaje;

  if (nuevaSuma > 100) {
    mostrarError(`La suma de porcentajes sería ${nuevaSuma}%. Máximo permitido: 100%`);
    return;
  }

  if (estadoApp.evaluacionesMateria.length >= 7) {
    mostrarError("No se pueden crear más de 7 evaluaciones por materia en el lapso");
    return;
  }

  mostrarCargando(true, "Creando evaluación...");

  try {
    const payload = {
      nombre,
      porcentaje,
      materia_id: Number(estadoApp.materiaActual),
      seccion_id: Number(estadoApp.seccionActual),
      lapso_id: Number(estadoApp.lapsoActual),
      docente_id: estadoApp.usuarioId,
      fecha,
      valor_maximo: valorMaximo,
      tecnica: tipoEval,
      instrumento,
      descripcion,
    };

    const data = await API.evaluaciones.crear(payload);

    if (!data?.ok) {
      throw new Error(data?.error || "No se pudo crear la evaluación");
    }

    mostrarExito("Evaluación creada exitosamente", 2000);

    // Limpiar formulario y recargar
    document.getElementById("form-nueva-evaluacion").reset();
    document.getElementById("input-valor-maximo").value = "20";
    document.getElementById("input-porcentaje").value = "20";

    // Recargar evaluaciones
    await cargarEvaluacionesMateria();

    mostrarCargando(false);
  } catch (error) {
    console.error("Error creando evaluación:", error);
    mostrarError(error.message || "Error al crear la evaluación");
    mostrarCargando(false);
  }
}

// ============================================================================
// 8. MOSTRAR TABLA DE ESTUDIANTES
// ============================================================================

async function mostrarTablaEstudiantes(evaluacionId) {
  estadoApp.evaluacionActual = evaluacionId;

  try {
    const evalData = await API.evaluaciones.obtenerPorId(evaluacionId);
    if (!evalData) throw new Error("No se encontró la evaluación");

    const { data: notas, error: notasError } = await supabase
      .from("evaluaciones_notas")
      .select("estudiante_id, nota, observacion")
      .eq("evaluacion_id", evaluacionId);

    let notasMap = {};
    if (notasError) {
      const { data: notasLegacy, error: notasLegacyError } = await supabase
        .from("calificaciones")
        .select("estudiante_id, nota, asistencia, observacion")
        .eq("evaluacion_id", evaluacionId);

      if (notasLegacyError) throw notasLegacyError;

      notasMap = (notasLegacy || []).reduce((acc, n) => {
        acc[n.estudiante_id] = {
          nota: n.nota,
          asistencia: n.asistencia,
          observacion: n.observacion,
        };
        return acc;
      }, {});
    } else {
      notasMap = (notas || []).reduce((acc, n) => {
        acc[n.estudiante_id] = {
          nota: n.nota,
          asistencia: true,
          observacion: n.observacion,
        };
        return acc;
      }, {});
    }

    // Construir tabla
    let html = "";
    estadoApp.estudiantesEnSeccion.forEach((est, index) => {
      const notaActual = notasMap[est.id];
      const nota = notaActual?.nota || "";
      const asistencia = notaActual?.asistencia !== false ? "checked" : "";
      const observacion = notaActual?.observacion || "";

      html += `
        <tr id="fila-${est.id}">
          <td>${est.cedula || "N/A"}</td>
          <td>${est.nombre}</td>
          <td>${est.apellido}</td>
          <td class="text-center">
            <input type="checkbox" class="asistencia-check" 
              data-estudiante="${est.id}" ${asistencia}>
          </td>
          <td>
            <input type="number" class="form-control input-nota" 
              id="nota-${est.id}" data-estudiante="${est.id}"
              min="1" max="20" step="0.1" value="${nota}"
              onchange="validarNota(this)">
          </td>
          <td>
            <textarea class="form-control form-control-sm" rows="1"
              id="obs-${est.id}" placeholder="Opcional">${observacion}</textarea>
          </td>
          <td>
            <span class="badge bg-secondary" id="estado-${est.id}">Vacío</span>
          </td>
        </tr>
      `;
    });

    document.getElementById("tbody-estudiantes").innerHTML = html;

    // Actualizar título
    document.querySelector("#card-estudiantes .card-header h5").textContent = 
      `📊 Cargar Notas - ${evalData.nombre_evaluacion}`;

    mostrarCargando(false);
  } catch (error) {
    console.error("Error mostrando tabla:", error);
    mostrarError("Error al cargar tabla de estudiantes");
  }
}

// ============================================================================
// 9. VALIDAR Y GUARDAR NOTAS
// ============================================================================

function validarNota(input) {
  const nota = parseFloat(input.value);
  const estudianteId = input.dataset.estudiante;

  if (!input.value) {
    input.classList.remove("error", "success");
    return;
  }

  if (!esNotaValida(nota)) {
    input.classList.add("error");
    input.classList.remove("success");
    document.getElementById(`estado-${estudianteId}`).textContent = "Inválida";
    document.getElementById(`estado-${estudianteId}`).className = "badge bg-danger";
  } else {
    input.classList.remove("error");
    input.classList.add("success");
    document.getElementById(`estado-${estudianteId}`).textContent = "Válida";
    document.getElementById(`estado-${estudianteId}`).className = "badge bg-success";
  }
}

async function guardarNotas() {
  if (!estadoApp.evaluacionActual) {
    mostrarError("Selecciona una evaluación primero");
    return;
  }

  // Usar bloqueo de botón para evitar doble envío
  const btn = document.getElementById('btnGuardarNotas');

  await runAsyncWithButton(btn, async () => {
    mostrarCargando(true, "Guardando notas...");

    try {
      const notasAGuardar = [];

    // Recolectar todas las notas
    estadoApp.estudiantesEnSeccion.forEach(est => {
      const notaInput = document.getElementById(`nota-${est.id}`);
      const asistenciaInput = document.querySelector(`.asistencia-check[data-estudiante="${est.id}"]`);
      const observacion = document.getElementById(`obs-${est.id}`).value;

      if (notaInput.value) {
        const nota = parseFloat(notaInput.value);

        if (!esNotaValida(nota)) {
          throw new Error(`Nota inválida para ${est.nombre} ${est.apellido}`);
        }

        notasAGuardar.push({
          evaluacion_id: estadoApp.evaluacionActual,
          estudiante_id: est.id,
          nota,
          asistencia: asistenciaInput.checked,
          observacion: observacion || null
        });
      }
    });

      if (notasAGuardar.length === 0) {
        mostrarAdvertencia("No hay notas para guardar");
        mostrarCargando(false);
        return;
      }

      const response = await API.evaluaciones.guardarNotas(
        estadoApp.evaluacionActual,
        notasAGuardar
      );

      if (!response?.ok) {
        throw new Error(response?.message || response?.error || "No se pudieron guardar las notas");
      }

      mostrarExito(`${notasAGuardar.length} notas guardadas exitosamente`, 2000);
      mostrarCargando(false);
    } catch (error) {
      console.error("Error guardando notas:", error);
      mostrarError(error.message || "Error al guardar las notas");
      mostrarCargando(false);
    }
  }, 'Guardando...');
}

// ============================================================================
// 10. UTILIDADES
// ============================================================================

function mostrarResumenPorcentajes() {
  const sumaActual = estadoApp.evaluacionesMateria.reduce((sum, e) => sum + e.porcentaje, 0);

  const container = document.getElementById("resumen-porcentajes");
  const fill = document.getElementById("porcentaje-visual");
  const texto = document.getElementById("porcentaje-texto");
  const estado = document.getElementById("porcentaje-estado");

  if (estadoApp.evaluacionesMateria.length > 0) {
    container.style.display = "block";
    fill.style.width = Math.min(sumaActual, 100) + "%";
    texto.textContent = sumaActual + "%";

    if (sumaActual === 100) {
      estado.innerHTML = `<span class="text-success fw-bold">✓ Total: ${sumaActual}% (Completo)</span>`;
    } else if (sumaActual < 100) {
      estado.innerHTML = `<span class="text-warning">⚠ Total: ${sumaActual}% (Faltan ${100 - sumaActual}%)</span>`;
    } else {
      estado.innerHTML = `<span class="text-danger">✗ Total: ${sumaActual}% (Excede 100%)</span>`;
    }
  } else {
    container.style.display = "none";
  }
}

async function verificarVentanaCarga(lapsoId) {
  try {
    const { data, error } = await supabase
      .from("ventanas_carga")
      .select("abierta, fecha_inicio, fecha_fin")
      .eq("lapso_id", lapsoId)
      .single();

    if (error) throw error;

    estadoApp.ventanaAbierta = data?.abierta || false;

    const ventanaInfoDiv = document.getElementById("ventana-info");
    if (data) {
      const inicio = formatearFecha(data.fecha_inicio);
      const fin = formatearFecha(data.fecha_fin);
      const estado = data.abierta ? "✓ Abierta" : "✗ Cerrada";
      const clase = data.abierta ? "text-success fw-bold" : "text-danger fw-bold";

      ventanaInfoDiv.innerHTML = `
        <p class="small mb-1"><strong>Estado:</strong> <span class="${clase}">${estado}</span></p>
        <p class="small mb-0">📅 Desde: ${inicio}</p>
        <p class="small">📅 Hasta: ${fin}</p>
      `;
    }
  } catch (error) {
    console.error("Error verificando ventana:", error);
  }
}

function seleccionarEvaluacion(evalId) {
  mostrarTablaEstudiantes(evalId);
}

async function eliminarEvaluacion(event, evalId) {
  event.stopPropagation();

  if (!confirm("¿Seguro que deseas eliminar esta evaluación? Se eliminarán todas sus notas.")) {
    return;
  }

  mostrarCargando(true, "Eliminando evaluación...");

  try {
    const { error } = await supabase
      .from("evaluaciones")
      .delete()
      .eq("id", evalId);

    if (error) throw error;

    mostrarExito("Evaluación eliminada", 2000);
    await cargarEvaluacionesMateria();
    mostrarCargando(false);
  } catch (error) {
    console.error("Error eliminando:", error);
    mostrarError("Error al eliminar la evaluación");
    mostrarCargando(false);
  }
}

function editarEvaluacion(event, evalId) {
  event.stopPropagation();
  mostrarAdvertencia("Función de edición en desarrollo");
}

function limpiarFormulario() {
  if (confirm("¿Limpiar todos los datos de notas?")) {
    estadoApp.estudiantesEnSeccion.forEach(est => {
      document.getElementById(`nota-${est.id}`).value = "";
      document.getElementById(`obs-${est.id}`).value = "";
      document.querySelector(`.asistencia-check[data-estudiante="${est.id}"]`).checked = true;
    });
  }
}

function configurarEventListeners() {
  // Cualquier event listener adicional aquí
}

// ============================================================================
// 11. FUNCIONES FALTANTES / HELPERS
// ============================================================================

/**
 * Valida que una nota sea numérica y esté entre 1 y 20
 */
function esNotaValida(nota) {
  return !isNaN(nota) && nota >= 0 && nota <= 20;
}

/**
 * Obtiene la sesión del usuario actual
 */
function obtenerSesionUsuario() {
  const sesion = sessionAPI.obtenerSesion();
  return sesion || { user_id: null, rol_principal: "" };
}

/**
 * Ejecuta una función asincrónica con feedback visual en el botón
 */
async function runAsyncWithButton(btn, fn, loadingText = "Guardando...") {
  if (!btn) return fn();
  
  const originalText = btn.textContent;
  const originalState = btn.disabled;
  
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
  
  try {
    return await fn();
  } finally {
    btn.textContent = originalText;
    btn.disabled = originalState;
  }
}

/**
 * Muestra un mensaje de advertencia temporal
 */
function mostrarAdvertencia(mensaje, duracion = 4000) {
  mostrarAlerta(mensaje, "warning", duracion);
}

// ============================================================================
// FIN DEL MÓDULO
// ============================================================================
