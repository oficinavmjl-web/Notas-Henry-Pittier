// ============================================================================
// SESIÓN Y AUTENTICACIÓN - Session Management
// ============================================================================

const SESSION_KEYS = {
  USER_SESSION: 'userSession',
  USER_EMAIL: 'userEmail',
  USER_ROLE: 'userRole',
};

const ALLOWED_ROLES = ['Superadmin', 'Directivo', 'Evaluacion_docente', 'Docente', 'Control_estudios'];

const sessionAPI = {
  /**
   * Guardar datos de sesión del usuario
   */
  guardarSesion: (user, rolData = {}) => {
    const sessionData = {
      user_id: user.id,
      email: user.email,
      nombre: user.user_metadata?.nombre || '',
      apellido: user.user_metadata?.apellido || '',
      cedula: user.user_metadata?.cedula || '',
      rol_principal: rolData.rol_principal || null,
      role_id: rolData.role_id || null,
      todos_roles: rolData.todos_roles || [],
      timestamp: new Date().getTime(),
    };

    sessionStorage.setItem(SESSION_KEYS.USER_SESSION, JSON.stringify(sessionData));
    localStorage.setItem(SESSION_KEYS.USER_EMAIL, user.email);
    if (rolData.rol_principal) {
      localStorage.setItem(SESSION_KEYS.USER_ROLE, rolData.rol_principal);
    } else {
      localStorage.removeItem(SESSION_KEYS.USER_ROLE);
    }
  },

  /**
   * Obtener sesión actual
   */
  obtenerSesion: () => {
    const sesion = sessionStorage.getItem(SESSION_KEYS.USER_SESSION);
    return sesion ? JSON.parse(sesion) : null;
  },

  /**
   * Obtener rol principal
   */
  obtenerRolPrincipal: () => {
    const sesion = sessionAPI.obtenerSesion();
    return sesion?.rol_principal || null;
  },

  /**
   * Obtener usuario actual
   */
  obtenerUsuario: () => {
    const sesion = sessionAPI.obtenerSesion();
    return sesion || null;
  },

  /**
   * Verificar si usuario está autenticado y tiene rol permitido
   */
  estaAutenticado: () => {
    const sesion = sessionAPI.obtenerSesion();
    if (!sesion || !sesion.user_id) return false;

    const rol = sesion.rol_principal || sesion.todos_roles?.find((role) => ALLOWED_ROLES.includes(role)) || null;
    return Boolean(rol && ALLOWED_ROLES.includes(rol));
  },

  /**
   * Limpiar sesión (logout)
   */
  limpiarSesion: () => {
    sessionStorage.removeItem(SESSION_KEYS.USER_SESSION);
    localStorage.removeItem(SESSION_KEYS.USER_EMAIL);
    localStorage.removeItem(SESSION_KEYS.USER_ROLE);
  },

  /**
   * Verificar si usuario tiene un rol específico
   */
  tieneRol: (rol) => {
    const sesion = sessionAPI.obtenerSesion();
    if (!sesion) return false;
    return sesion.rol_principal === rol || sesion.todos_roles?.includes(rol);
  },

  /**
   * Obtener información del usuario
   */
  obtenerInfo: (campo) => {
    const sesion = sessionAPI.obtenerSesion();
    if (!sesion) return null;
    return campo ? sesion[campo] : sesion;
  },
};

// ============================================================================
// MAPA DE REDIRECCIONES POR ROL
// ============================================================================

const ROLE_REDIRECTS = {
  'Superadmin': '/pages/superadmin/dashboard.html',
  'Directivo': '/pages/directivo/dashboard.html',
  'Evaluacion_docente': '/pages/evaluacion_docente/dashboard.html',
  'Docente': '/pages/docente/dashboard.html',
  'Control_estudios': '/pages/control_estudios/dashboard.html',
};

// ============================================================================
// FUNCIONES DE NAVEGACIÓN
// ============================================================================

const nav = {
  /**
   * Redirigir según rol principal del usuario
   */
  redirigirPorRol: () => {
    const rol = sessionAPI.obtenerRolPrincipal();
    if (!rol || !ALLOWED_ROLES.includes(rol)) {
      window.location.href = '/index.html?access_denied=1';
      return;
    }

    const url = ROLE_REDIRECTS[rol];
    if (url) {
      window.location.href = url;
    } else {
      window.location.href = '/index.html?access_denied=1';
    }
  },

  /**
   * Ir a un rol específico
   */
  irARol: (rol) => {
    if (!ALLOWED_ROLES.includes(rol)) {
      return;
    }
    const url = ROLE_REDIRECTS[rol];
    if (url) {
      window.location.href = url;
    }
  },

  /**
   * Logout
   */
  logout: async () => {
    try {
      await supabase.auth.signOut();
      sessionAPI.limpiarSesion();
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Error en logout:', error);
      window.location.href = '/index.html';
    }
  },

  /**
   * Ir a página de perfil
   */
  irAPerfil: () => {
    window.location.href = '/pages/perfil.html';
  },

  /**
   * Volver a dashboard principal según rol
   */
  volverADashboard: () => {
    nav.redirigirPorRol();
  },
};

window.sessionAPI = sessionAPI;
window.nav = nav;
