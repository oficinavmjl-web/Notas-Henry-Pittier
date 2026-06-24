// ============================================================================
// UTILIDADES GLOBALES - SISTEMA GESTIÓN ACADÉMICA
// ============================================================================
// Importar este archivo en todas las páginas: <script src="../js/utils-mejorado.js"></script>

// ============================================================================
// 1. GESTIÓN DE SESIÓN
// ============================================================================

/**
 * Obtiene los datos de sesión del usuario actual
 * @returns {Object|null} Datos de sesión o null si no está autenticado
 */
function obtenerSesionUsuario() {
  try {
    const sessionData = sessionStorage.getItem("userSession");
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (e) {
    console.error("Error obteniendo sesión:", e);
    return null;
  }
}

/**
 * Verifica si el usuario está autenticado
 * @returns {Boolean}
 */
function estaAutenticado() {
  return obtenerSesionUsuario() !== null;
}

/**
 * Obtiene el rol principal del usuario actual
 * @returns {String} Nombre del rol (ej: "Docente")
 */
function obtenerRolPrincipal() {
  const sesion = obtenerSesionUsuario();
  return sesion?.rol_principal || null;
}

/**
 * Obtiene el ID del rol principal del usuario
 * @returns {Number|null} ID del rol
 */
function obtenerRoleId() {
  const sesion = obtenerSesionUsuario();
  return sesion?.role_id ?? null;
}

/**
 * Verifica si el usuario tiene un rol específico
 * @param {String} rol - Nombre del rol a verificar
 * @returns {Boolean}
 */
function tieneRol(rol) {
  const sesion = obtenerSesionUsuario();
  return sesion?.todos_roles?.includes(rol) || false;
}

/**
 * Verifica si el usuario es Superadmin
 * @returns {Boolean}
 */
function esSuperadmin() {
  return tieneRol("Superadmin");
}

/**
 * Verifica si el usuario es Directivo
 * @returns {Boolean}
 */
function esDirectivo() {
  return tieneRol("Directivo");
}

/**
 * Verifica si el usuario es de Evaluación Docente
 * @returns {Boolean}
 */
function esEvaluador() {
  return tieneRol("Evaluacion_docente");
}

/**
 * Verifica si el usuario es Docente
 * @returns {Boolean}
 */
function esDocente() {
  return tieneRol("Docente");
}

/**
 * Verifica si el usuario es de Control de Estudios
 * @returns {Boolean}
 */
function esControlEstudios() {
  return tieneRol("Control_estudios");
}

/**
 * Verifica si el usuario es Estudiante
 * @returns {Boolean}
 */
function esEstudiante() {
  return tieneRol("Estudiante");
}

/**
 * Obtiene el nombre completo del usuario
 * @returns {String}
 */
function obtenerNombreUsuario() {
  const sesion = obtenerSesionUsuario();
  if (!sesion) return "Usuario";
  return `${sesion.nombre} ${sesion.apellido}`.trim() || sesion.email;
}

/**
 * Obtiene el email del usuario
 * @returns {String}
 */
function obtenerEmailUsuario() {
  const sesion = obtenerSesionUsuario();
  return sesion?.email || "";
}

/**
 * Obtiene el ID del usuario
 * @returns {String|null}
 */
function obtenerUsuarioId() {
  const sesion = obtenerSesionUsuario();
  return sesion?.user_id || null;
}

/**
 * Logout del usuario
 */
async function logout() {
  await supabase.auth.signOut();
  sessionStorage.removeItem("userSession");
  localStorage.removeItem("userEmail");
  window.location.href = "/pages/login.html";
}

// ============================================================================
// 2. VALIDACIONES DE ACCESO
// ============================================================================

/**
 * Valida permisos de acceso por rol
 * @param {Array<String>} rolesPermitidos - Array de roles permitidos
 * @returns {Boolean}
 */
function validarAcceso(rolesPermitidos) {
  if (!estaAutenticado()) {
    console.warn("Usuario no autenticado");
    return false;
  }

  const rolUsuario = obtenerRolPrincipal();
  const tieneAcceso = rolesPermitidos.includes(rolUsuario);

  if (!tieneAcceso) {
    console.warn(`Acceso denegado. Rol actual: ${rolUsuario}. Roles permitidos: ${rolesPermitidos.join(", ")}`);
  }

  return tieneAcceso;
}

/**
 * Redirige si no tiene permiso
 * @param {Array<String>} rolesPermitidos
 * @param {String} urlSiNoAcceso - URL a redirigir si no tiene acceso
 */
function validarAccesoORedireccionar(rolesPermitidos, urlSiNoAcceso = "/pages/login.html") {
  if (!validarAcceso(rolesPermitidos)) {
    window.location.href = urlSiNoAcceso;
    return false;
  }
  return true;
}

/**
 * Verifica si el usuario puede editar datos de otro usuario
 * @param {String} usuarioIdAEditar - ID del usuario a editar
 * @param {String} usuarioIdActual - ID del usuario actual
 * @returns {Boolean}
 */
function puedeEditarUsuario(usuarioIdAEditar, usuarioIdActual) {
  // Puede editar su propio usuario
  if (usuarioIdAEditar === usuarioIdActual) return true;

  // Superadmin puede editar a todos
  if (esSuperadmin()) return true;

  // Directivo puede editar a docentes y personal (excepto superadmin)
  if (esDirectivo()) {
    // Verificar que el usuario a editar no es superadmin
    return true; // Esto requeriría verificación en backend
  }

  return false;
}

// ============================================================================
// 3. UTILIDADES ACADÉMICAS
// ============================================================================

/**
 * Calcula promedio de notas
 * @param {Array<Number>} notas - Array de notas
 * @returns {Number} Promedio redondeado a 2 decimales
 */
function calcularPromedio(notas) {
  if (!notas || notas.length === 0) return 0;
  const suma = notas.reduce((a, b) => a + b, 0);
  return Math.round((suma / notas.length) * 100) / 100;
}

/**
 * Valida si una nota está en rango permitido (1-20)
 * @param {Number} nota
 * @returns {Boolean}
 */
function esNotaValida(nota) {
  const n = parseFloat(nota);
  return !isNaN(n) && n >= 1 && n <= 20;
}

/**
 * Calcula promedios ponderados
 * @param {Array<Object>} evaluaciones - [{nota: 15, porcentaje: 30}, ...]
 * @returns {Number}
 */
function calcularPromedioPonderado(evaluaciones) {
  if (!evaluaciones || evaluaciones.length === 0) return 0;

  const totalPorcentaje = evaluaciones.reduce((sum, e) => sum + (e.porcentaje || 0), 0);
  const notaPonderada = evaluaciones.reduce((sum, e) => sum + (e.nota * e.porcentaje / 100), 0);

  return totalPorcentaje > 0 ? Math.round(notaPonderada * 100) / 100 : 0;
}

/**
 * Valida restricciones de evaluaciones (max 7, max 25% c/u, total 100%)
 * @param {Array<Object>} evaluaciones - [{porcentaje: 25, ...}, ...]
 * @returns {Object} {valido: Boolean, errores: Array}
 */
function validarEvaluaciones(evaluaciones) {
  const errores = [];

  if (evaluaciones.length > 7) {
    errores.push("No se pueden crear más de 7 evaluaciones por materia");
  }

  const totalPorcentaje = evaluaciones.reduce((sum, e) => sum + (e.porcentaje || 0), 0);
  if (totalPorcentaje !== 100) {
    errores.push(`La suma de porcentajes debe ser 100% (actual: ${totalPorcentaje}%)`);
  }

  const conPorcentajeAlto = evaluaciones.filter(e => (e.porcentaje || 0) > 25);
  if (conPorcentajeAlto.length > 0) {
    errores.push("Ninguna evaluación puede tener más del 25% de peso");
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// ============================================================================
// 4. UTILIDADES DE UI/UX
// ============================================================================

/**
 * Muestra alerta de éxito
 * @param {String} mensaje
 * @param {Number} duracion - Milisegundos (0 = sin auto-cierre)
 */
function mostrarExito(mensaje, duracion = 3000) {
  const alertId = `alert-${Date.now()}`;
  const html = `
    <div id="${alertId}" class="alert alert-success alert-dismissible fade show" role="alert">
      <strong>✓ Éxito:</strong> ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  const container = document.getElementById("alerts-container") || document.body;
  const alertEl = document.createElement("div");
  alertEl.innerHTML = html;
  container.insertBefore(alertEl.firstElementChild, container.firstChild);

  if (duracion > 0) {
    setTimeout(() => {
      const el = document.getElementById(alertId);
      if (el) el.remove();
    }, duracion);
  }
}

/**
 * Muestra alerta de error
 * @param {String} mensaje
 * @param {Number} duracion
 */
function mostrarError(mensaje, duracion = 0) {
  const alertId = `alert-${Date.now()}`;
  const html = `
    <div id="${alertId}" class="alert alert-danger alert-dismissible fade show" role="alert">
      <strong>✗ Error:</strong> ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  const container = document.getElementById("alerts-container") || document.body;
  const alertEl = document.createElement("div");
  alertEl.innerHTML = html;
  container.insertBefore(alertEl.firstElementChild, container.firstChild);

  if (duracion > 0) {
    setTimeout(() => {
      const el = document.getElementById(alertId);
      if (el) el.remove();
    }, duracion);
  }
}

/**
 * Muestra alerta de advertencia
 * @param {String} mensaje
 */
function mostrarAdvertencia(mensaje) {
  const alertId = `alert-${Date.now()}`;
  const html = `
    <div id="${alertId}" class="alert alert-warning alert-dismissible fade show" role="alert">
      <strong>⚠ Advertencia:</strong> ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  const container = document.getElementById("alerts-container") || document.body;
  const alertEl = document.createElement("div");
  alertEl.innerHTML = html;
  container.insertBefore(alertEl.firstElementChild, container.firstChild);
}

/**
 * Muestra un spinner de carga
 * @param {Boolean} mostrar
 * @param {String} mensaje
 */
function mostrarCargando(mostrar = true, mensaje = "Cargando...") {
  const spinnerId = "loading-spinner";
  let spinner = document.getElementById(spinnerId);

  if (mostrar) {
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.id = spinnerId;
      spinner.className = "spinner-container";
      spinner.innerHTML = `
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p>${mensaje}</p>
      `;
      document.body.appendChild(spinner);
    }
  } else {
    if (spinner) spinner.remove();
  }
}

// ============================================================================
// 4.b UTILIDADES DE BLOQUEO / PREVENCIÓN DE DOBLE ENVÍO
// ============================================================================

/**
 * Marca un botón como en estado "submitting": lo deshabilita y cambia su texto
 * @param {HTMLElement|String} btn
 * @param {String} texto
 */
function setSubmittingButton(btn, texto = "Enviando...") {
  const el = typeof btn === 'string' ? document.getElementById(btn) : btn;
  if (!el) return;
  if (!el.dataset._originalHtml) el.dataset._originalHtml = el.innerHTML;
  el.disabled = true;
  el.innerHTML = texto;
  el.classList.add('disabled');
}

/**
 * Restaura el estado original del botón
 * @param {HTMLElement|String} btn
 */
function clearSubmittingButton(btn) {
  const el = typeof btn === 'string' ? document.getElementById(btn) : btn;
  if (!el) return;
  el.disabled = false;
  if (el.dataset._originalHtml) {
    el.innerHTML = el.dataset._originalHtml;
    delete el.dataset._originalHtml;
  }
  el.classList.remove('disabled');
}

/**
 * Ejecuta una función async mientras bloquea un botón para evitar envíos duplicados
 * @param {HTMLElement|String} btn
 * @param {Function} asyncFn - función asíncrona a ejecutar
 * @param {String} textoOpcional - texto mostrado mientras dura la operación
 */
async function runAsyncWithButton(btn, asyncFn, textoOpcional = 'Enviando...') {
  try {
    setSubmittingButton(btn, textoOpcional);
    return await asyncFn();
  } finally {
    clearSubmittingButton(btn);
  }
}

// ============================================================================
// 5. UTILIDADES DE FORMATO
// ============================================================================

/**
 * Formatea una fecha a formato es-ES
 * @param {Date|String} fecha
 * @returns {String} Ej: "21 de junio de 2026"
 */
function formatearFecha(fecha) {
  const date = typeof fecha === "string" ? new Date(fecha) : fecha;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/**
 * Formatea una fecha y hora
 * @param {Date|String} fecha
 * @returns {String} Ej: "21 de junio de 2026 14:30"
 */
function formatearFechaHora(fecha) {
  const date = typeof fecha === "string" ? new Date(fecha) : fecha;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Formatea un número con decimales
 * @param {Number} numero
 * @param {Number} decimales
 * @returns {String}
 */
function formatearNumero(numero, decimales = 2) {
  return parseFloat(numero).toFixed(decimales);
}

/**
 * Determina color de nota (rojo < 10, amarillo 10-14, verde >= 15)
 * @param {Number} nota
 * @returns {String} - "danger", "warning", "success"
 */
function obtenerColorNota(nota) {
  const n = parseFloat(nota);
  if (n < 10) return "danger";
  if (n < 15) return "warning";
  return "success";
}

// ============================================================================
// 6. UTILIDADES DE ALMACENAMIENTO
// ============================================================================

/**
 * Guarda datos en localStorage
 * @param {String} clave
 * @param {Any} valor
 */
function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    console.error("Error guardando en localStorage:", e);
  }
}

/**
 * Obtiene datos de localStorage
 * @param {String} clave
 * @param {Any} valorPorDefecto
 * @returns {Any}
 */
function obtenerLocal(clave, valorPorDefecto = null) {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : valorPorDefecto;
  } catch (e) {
    console.error("Error obteniendo de localStorage:", e);
    return valorPorDefecto;
  }
}

/**
 * Elimina datos de localStorage
 * @param {String} clave
 */
function eliminarLocal(clave) {
  try {
    localStorage.removeItem(clave);
  } catch (e) {
    console.error("Error eliminando de localStorage:", e);
  }
}

// ============================================================================
// 7. UTILIDADES DE SUPABASE
// ============================================================================

/**
 * Realiza consulta SELECT en una tabla
 * @param {String} tabla
 * @param {Object} filtros - {campo: valor, ...}
 * @param {Array<String>} columnas
 * @returns {Promise<Array>}
 */
async function obtenerDatos(tabla, filtros = {}, columnas = "*") {
  try {
    let query = supabase.from(tabla).select(columnas);

    Object.entries(filtros).forEach(([campo, valor]) => {
      if (valor !== null && valor !== undefined) {
        query = query.eq(campo, valor);
      }
    });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error(`Error obteniendo datos de ${tabla}:`, e);
    mostrarError(`Error al cargar datos`);
    return [];
  }
}

/**
 * Inserta un registro
 * @param {String} tabla
 * @param {Object} datos
 * @returns {Promise<Object|null>}
 */
async function insertarDato(tabla, datos) {
  try {
    const { data, error } = await supabase
      .from(tabla)
      .insert([datos])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (e) {
    console.error(`Error insertando en ${tabla}:`, e);
    mostrarError(`Error al guardar los datos`);
    return null;
  }
}

/**
 * Actualiza un registro
 * @param {String} tabla
 * @param {Object} datos
 * @param {Object} filtro
 * @returns {Promise<Object|null>}
 */
async function actualizarDato(tabla, datos, filtro) {
  try {
    let query = supabase.from(tabla).update(datos);

    Object.entries(filtro).forEach(([campo, valor]) => {
      query = query.eq(campo, valor);
    });

    const { data, error } = await query.select();
    if (error) throw error;
    return data?.[0] || null;
  } catch (e) {
    console.error(`Error actualizando ${tabla}:`, e);
    mostrarError(`Error al actualizar los datos`);
    return null;
  }
}

/**
 * Elimina un registro
 * @param {String} tabla
 * @param {Object} filtro
 * @returns {Promise<Boolean>}
 */
async function eliminarDato(tabla, filtro) {
  try {
    let query = supabase.from(tabla).delete();

    Object.entries(filtro).forEach(([campo, valor]) => {
      query = query.eq(campo, valor);
    });

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(`Error eliminando de ${tabla}:`, e);
    mostrarError(`Error al eliminar los datos`);
    return false;
  }
}

// ============================================================================
// 8. INICIALIZACIÓN
// ============================================================================

/**
 * Verifica autenticación al cargar página
 * Si no está autenticado, redirige a login
 */
function verificarAutenticacion() {
  if (!estaAutenticado()) {
    console.warn("Usuario no autenticado, redirigiendo a login...");
    window.location.href = "/pages/login.html";
  }
}

// Ejecutar verificación si la página lo requiere
document.addEventListener("DOMContentLoaded", function() {
  // Si la página NO es login ni índice, verificar autenticación
  const paginaActual = window.location.pathname;
  if (!paginaActual.includes("login") && !paginaActual.endsWith("index.html") && !paginaActual.endsWith("/")) {
    // Descomentar si deseas verificación automática
    // verificarAutenticacion();
  }
});

// ============================================================================
// FIN DE UTILIDADES
// ============================================================================
