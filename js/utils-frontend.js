// ============================================================================
// UTILIDADES GLOBALES DEL FRONTEND
// ============================================================================
// Funciones compartidas para todos los módulos y dashboards

/**
 * Valida que el usuario esté autenticado y tenga el rol correcto
 * @param {string|array} rolesPermitidos - Rol o array de roles permitidos
 * @returns {boolean} True si tiene permiso
 */
function validarAcceso(rolesPermitidos) {
  const sesion = sessionAPI.obtenerSesion();
  if (!sesion || !sesion.user) {
    mostrarError("Sesión expirada. Por favor, inicia sesión nuevamente.");
    window.location.href = "/index.html";
    return false;
  }

  if (!rolesPermitidos) return true;

  const rolesArray = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
  const tienePermiso = rolesArray.some(rol =>
    sesion.rol_principal?.toLowerCase() === rol.toLowerCase()
  );

  if (!tienePermiso) {
    mostrarError(`Acceso denegado. Tu rol (${sesion.rol_principal}) no tiene permisos.`);
    nav.redirigirPorRol();
    return false;
  }

  return true;
}

/**
 * Obtiene el nombre completo del usuario autenticado
 * @returns {string} "Nombres Apellidos" o "Usuario desconocido"
 */
function obtenerNombreUsuario() {
  const sesion = sessionAPI.obtenerSesion();
  if (!sesion || !sesion.user) return "Usuario desconocido";
  
  const nombres = sesion.user.user_metadata?.nombres || "";
  const apellidos = sesion.user.user_metadata?.apellidos || "";
  
  return `${nombres} ${apellidos}`.trim() || sesion.user.email || "Usuario";
}

/**
 * Obtiene el UUID del usuario autenticado
 * @returns {string} UUID del usuario o null
 */
function obtenerUserID() {
  const sesion = sessionAPI.obtenerSesion();
  return sesion?.user?.id || null;
}

/**
 * Obtiene el rol principal del usuario
 * @returns {string} Nombre del rol (ej: "Docente", "Directivo")
 */
function obtenerRolPrincipal() {
  const sesion = sessionAPI.obtenerSesion();
  return sesion?.rol_principal || "";
}

/**
 * Cierra sesión y redirige al login
 */
async function logout() {
  try {
    sessionAPI.limpiarSesion();
    await supabase.auth.signOut();
    window.location.href = "/index.html";
  } catch (error) {
    console.error("Error en logout:", error);
    window.location.href = "/index.html";
  }
}

/**
 * Muestra un spinner/indicador de carga
 * @param {string} mensaje - Mensaje opcional a mostrar
 */
function mostrarCargando(mensaje = "Cargando...") {
  let spinner = document.getElementById("spinnerGlobal");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "spinnerGlobal";
    spinner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    `;
    spinner.innerHTML = `
      <div class="text-center text-white">
        <div class="spinner-border mb-3" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p>${mensaje}</p>
      </div>
    `;
    document.body.appendChild(spinner);
  }
  spinner.style.display = "flex";
}

/**
 * Oculta el spinner de carga
 */
function ocultarCargando() {
  const spinner = document.getElementById("spinnerGlobal");
  if (spinner) spinner.style.display = "none";
}

/**
 * Muestra un mensaje de error temporal
 * @param {string} mensaje - Mensaje de error
 * @param {number} duracion - Duración en ms (0 = permanente)
 */
function mostrarError(mensaje, duracion = 5000) {
  mostrarAlerta(mensaje, "danger", duracion);
}

/**
 * Muestra un mensaje de éxito temporal
 * @param {string} mensaje - Mensaje de éxito
 * @param {number} duracion - Duración en ms (0 = permanente)
 */
function mostrarExito(mensaje, duracion = 3000) {
  mostrarAlerta(mensaje, "success", duracion);
}

/**
 * Muestra una alerta genérica
 * @param {string} mensaje - Mensaje
 * @param {string} tipo - Tipo: "success", "danger", "warning", "info"
 * @param {number} duracion - Duración en ms (0 = permanente)
 */
function mostrarAlerta(mensaje, tipo = "info", duracion = 0) {
  let alertContainer = document.getElementById("alertaGlobal");
  
  if (!alertContainer) {
    alertContainer = document.createElement("div");
    alertContainer.id = "alertaGlobal";
    alertContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      min-width: 300px;
      max-width: 500px;
    `;
    document.body.appendChild(alertContainer);
  }

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${mensaje}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  alertContainer.appendChild(alertDiv);

  if (duracion > 0) {
    setTimeout(() => {
      alertDiv.remove();
    }, duracion);
  }
}

/**
 * Valida un número como nota académica (0-20)
 * @param {number} nota - Valor a validar
 * @returns {object} { valido: boolean, error?: string }
 */
function validarNota(nota) {
  const num = parseFloat(nota);
  
  if (isNaN(num)) {
    return { valido: false, error: "La nota debe ser un número" };
  }
  
  if (num < 0 || num > 20) {
    return { valido: false, error: "La nota debe estar entre 0 y 20" };
  }
  
  return { valido: true };
}

/**
 * Valida un porcentaje (0-100)
 * @param {number} porcentaje - Valor a validar
 * @returns {object} { valido: boolean, error?: string }
 */
function validarPorcentaje(porcentaje) {
  const num = parseFloat(porcentaje);
  
  if (isNaN(num)) {
    return { valido: false, error: "El porcentaje debe ser un número" };
  }
  
  if (num <= 0 || num > 100) {
    return { valido: false, error: "El porcentaje debe estar entre 1 y 100" };
  }
  
  return { valido: true };
}

/**
 * Formatea una fecha ISO a formato legible
 * @param {string} fecha - Fecha ISO (ej: "2026-06-24")
 * @param {string} formato - Formato deseado: "corto", "largo", "completo"
 * @returns {string} Fecha formateada
 */
function formatearFecha(fecha, formato = "corto") {
  if (!fecha) return "-";
  
  const fecha_obj = new Date(fecha + "T00:00:00");
  
  const opciones = {
    corto: { day: "numeric", month: "2-digit", year: "numeric" },
    largo: { day: "numeric", month: "long", year: "numeric" },
    completo: { 
      weekday: "long", 
      day: "numeric", 
      month: "long", 
      year: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    },
  };

  return fecha_obj.toLocaleDateString("es-ES", opciones[formato] || opciones.corto);
}

/**
 * Formatea una hora ISO a formato HH:MM
 * @param {string} hora - Hora ISO (ej: "14:30:00")
 * @returns {string} Hora formateada
 */
function formatearHora(hora) {
  if (!hora) return "-";
  return hora.substring(0, 5);
}

/**
 * Exporta tabla a CSV
 * @param {string} idTabla - ID de la tabla HTML
 * @param {string} nombreArchivo - Nombre del archivo CSV
 */
function exportarTablaCSV(idTabla, nombreArchivo = "exportacion.csv") {
  const tabla = document.getElementById(idTabla);
  if (!tabla) {
    mostrarError("No se encontró la tabla");
    return;
  }

  let csv = [];
  
  // Headers
  const headers = tabla.querySelectorAll("thead th");
  csv.push(Array.from(headers).map(h => `"${h.textContent.trim()}"`).join(","));
  
  // Rows
  const rows = tabla.querySelectorAll("tbody tr");
  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    csv.push(Array.from(cells).map(cell => `"${cell.textContent.trim()}"`).join(","));
  });

  // Descargar
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Marca un elemento como cargando (loader visual)
 * @param {HTMLElement} elemento - Elemento a marcar
 */
function marcarCargando(elemento) {
  if (!elemento) return;
  elemento.disabled = true;
  const originalText = elemento.textContent;
  elemento.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    Cargando...
  `;
  elemento._originalText = originalText;
}

/**
 * Desmarca un elemento como cargando
 * @param {HTMLElement} elemento - Elemento a desmarcar
 */
function desmarcarCargando(elemento) {
  if (!elemento) return;
  elemento.disabled = false;
  elemento.textContent = elemento._originalText || "Guardar";
}

/**
 * Valida que un formulario tenga todos los campos obligatorios
 * @param {string} idFormulario - ID del formulario
 * @returns {object} { valido: boolean, campos?: string[] }
 */
function validarFormulario(idFormulario) {
  const form = document.getElementById(idFormulario);
  if (!form) return { valido: false, campos: ["Formulario no encontrado"] };

  const camposRequeridos = form.querySelectorAll("[required]");
  const camposVacios = [];

  camposRequeridos.forEach(campo => {
    if (!campo.value || campo.value.trim() === "") {
      camposVacios.push(campo.name || campo.id || "Campo desconocido");
    }
  });

  return {
    valido: camposVacios.length === 0,
    campos: camposVacios,
  };
}

/**
 * Inicializa event listeners comunes en todas las páginas
 */
function inicializarEventosGlobales() {
  // Cerrar alerta del primer botón de close
  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-bs-dismiss='alert']")) {
      e.target.closest(".alert")?.remove();
    }
  });

  // Logout si sesión expira
  window.addEventListener("beforeunload", () => {
    const sesion = sessionAPI.obtenerSesion();
    if (!sesion) {
      window.location.href = "/index.html";
    }
  });
}

// Inicializar al cargar el script
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarEventosGlobales);
} else {
  inicializarEventosGlobales();
}
