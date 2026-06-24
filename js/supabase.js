// Reemplaza con tus claves reales
const SUPABASE_URL = "https://slwbzfxwrxrsnlizapps.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9yQQumW9JF5A-NjFjtp3Og_7HBfSDpr";

// Crear cliente correctamente SIN colisión de nombres
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEGACY_FUNCTIONS = {
  'users-create_user': 'modulo-usuarios',
  'users-list_users': 'modulo-usuarios',
  'users-get_user': 'modulo-usuarios',
  'users-update_user': 'modulo-usuarios',
  'users-enable_user': 'modulo-usuarios',
  'users-disable_user': 'modulo-usuarios',
  'users-change_email': 'modulo-usuarios',
  'users-reset_password': 'modulo-usuarios',

  'periodos-list_anios': 'modulo-periodos',
  'periodos-create_anio': 'modulo-periodos',
  'periodos-list_lapsos': 'modulo-periodos',
  'periodos-create_lapso': 'modulo-periodos',
  'periodos-activate_lapso': 'modulo-periodos',
  'periodos-close_lapso': 'modulo-periodos',
  'periodos-close_anio': 'modulo-periodos',
  'periodos-get_activo': 'modulo-periodos',

  'secciones-listar': 'modulo-secciones',
  'secciones-crear': 'modulo-secciones',
  'secciones-editar': 'modulo-secciones',
  'secciones-asignar-docente': 'modulo-secciones',
  'secciones-cambiar-docente': 'modulo-secciones',
  'secciones-listar-materias': 'modulo-secciones',
  'secciones-agregar-materia': 'modulo-secciones',
  'secciones-quitar-materia': 'modulo-secciones',
  'secciones-clonar-otro-anio': 'modulo-secciones',
  'secciones-toggle': 'modulo-secciones',

  'listar-estudiantes': 'modulo-estudiantes',
  'inscribir-estudiante': 'modulo-estudiantes',
  'cambiar-seccion': 'modulo-estudiantes',
  'promover-estudiante': 'modulo-estudiantes',
  'repetir-grado': 'modulo-estudiantes',
  'retirar-estudiante': 'modulo-estudiantes',
};

const parseBody = (body) => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (error) {
      return body;
    }
  }
  return body;
};

const getAuthHeaders = async (headers = {}) => {
  const resolvedHeaders = new Headers(headers);
  resolvedHeaders.set('apikey', SUPABASE_ANON_KEY);

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData?.session?.access_token) {
      resolvedHeaders.set('Authorization', `Bearer ${sessionData.session.access_token}`);
    }
  } catch (error) {
    console.warn('No se pudo obtener la sesión de auth para la Edge Function:', error);
  }

  return resolvedHeaders;
};

const enrichFunctionError = async (response, functionName) => {
  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch (error) {
    bodyText = '';
  }

  let parsedBody = null;
  if (bodyText) {
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (error) {
      parsedBody = bodyText;
    }
  }

  const message = parsedBody && typeof parsedBody === 'object' && parsedBody.error
    ? parsedBody.error
    : parsedBody || `La función ${functionName} devolvió un estado ${response.status}`;

  const error = new Error(message);
  error.status = response.status;
  error.body = parsedBody;
  return error;
};

const toNumericRol = (rol) => {
  if (typeof rol === 'number') return rol;
  const normalized = String(rol || '').trim().toLowerCase();
  if (normalized.includes('super')) return 5;
  if (normalized.includes('direct')) return 4;
  if (normalized.includes('evalu')) return 6;
  if (normalized.includes('control')) return 2;
  return 3;
};

const mapLegacyCall = (functionName, body) => {
  const payload = parseBody(body);

  if (functionName === 'users-create_user') {
    const data = payload || {};
    return {
      functionName: 'modulo-usuarios',
      body: {
        action: 'create_user',
        data: {
          email: data.email || '',
          password: data.password || '',
          id_rol: data.id_rol || toNumericRol(data.rol || data.role || ''),
          username: data.username || data.email?.split('@')[0] || '',
          nombres: data.nombre || data.nombres || '',
          apellidos: data.apellido || data.apellidos || '',
          cedula: data.cedula || data.ci || '',
        },
      },
    };
  }

  if (functionName === 'users-list_users') {
    return { functionName: 'modulo-usuarios', body: { action: 'list_users', data: payload || {} } };
  }

  if (functionName === 'users-get_user') {
    const data = payload || {};
    return { functionName: 'modulo-usuarios', body: { action: 'list_users', data: { user_id: data.user_id || data.userId || data.id || '' } } };
  }

  if (functionName === 'users-update_user') {
    const data = payload || {};
    return {
      functionName: 'modulo-usuarios',
      body: {
        action: 'update_user',
        data: {
          target_user_id: data.user_id || data.userId || data.id || '',
          email: data.email || '',
          nombres: data.nombre || data.nombres || '',
          apellidos: data.apellido || data.apellidos || '',
          cedula: data.cedula || data.ci || '',
          activo: data.activo ?? data.active ?? true,
        },
      },
    };
  }

  if (functionName === 'users-enable_user' || functionName === 'users-disable_user') {
    const data = payload || {};
    return {
      functionName: 'modulo-usuarios',
      body: {
        action: 'toggle_status',
        data: {
          target_user_id: data.user_id || data.userId || data.id || '',
          status: functionName === 'users-enable_user' ? 'enable' : 'disable',
        },
      },
    };
  }

  if (functionName === 'users-change_email') {
    const data = payload || {};
    return {
      functionName: 'modulo-usuarios',
      body: {
        action: 'update_user',
        data: {
          target_user_id: data.user_id || data.userId || data.id || '',
          email: data.new_email || data.email || '',
        },
      },
    };
  }

  if (functionName === 'users-reset_password') {
    const data = payload || {};
    return {
      functionName: 'modulo-usuarios',
      body: {
        action: 'reset_password',
        data: {
          target_user_id: data.user_id || data.userId || data.id || '',
          new_password: data.new_password || data.password || '',
        },
      },
    };
  }

  if (functionName === 'modulo-usuarios') {
    const data = payload || {};
    if (data && typeof data === 'object' && data.action) {
      return { functionName: 'modulo-usuarios', body: data };
    }
  }

  if (functionName === 'periodos-list_anios') {
    return { functionName: 'modulo-periodos', body: { action: 'listar', data: {} } };
  }

  if (functionName === 'periodos-create_anio') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'crear_anio',
        data: {
          nombre: data.nombre || data.name || '',
          fecha_inicio: data.fecha_inicio || data.fechaInicio || '',
          fecha_fin: data.fecha_fin || data.fechaFin || '',
        },
      },
    };
  }

  if (functionName === 'periodos-list_lapsos') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'listar_lapsos',
        data: { id_anio: data.anio_id || data.id_anio || data.anioId || data.id || '' },
      },
    };
  }

  if (functionName === 'periodos-create_lapso') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'crear_lapso',
        data: {
          id_anio: data.anio_id || data.id_anio || data.anioId || '',
          nombre: data.nombre || data.name || '',
          fecha_inicio: data.fecha_inicio || data.fechaInicio || '',
          fecha_fin: data.fecha_fin || data.fechaFin || '',
        },
      },
    };
  }

  if (functionName === 'periodos-activate_lapso') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'activar_lapso',
        data: { id_lapso: data.lapso_id || data.id_lapso || data.id || '' },
      },
    };
  }

  if (functionName === 'periodos-close_lapso') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'cerrar_lapso',
        data: { id_lapso: data.lapso_id || data.id_lapso || data.id || '' },
      },
    };
  }

  if (functionName === 'periodos-close_anio') {
    const data = payload || {};
    return {
      functionName: 'modulo-periodos',
      body: {
        action: 'cerrar_anio',
        data: { id_anio: data.anio_id || data.id_anio || data.anioId || data.id || '' },
      },
    };
  }

  if (functionName === 'periodos-get_activo') {
    return { functionName: 'modulo-periodos', body: { action: 'obtener_activo', data: {} } };
  }

  if (functionName === 'secciones-listar') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'listar-secciones',
        anio_escolar_id: data.anio_escolar_id || data.anioId || data.id_anio || data.anio_id || null,
        activo: data.activo ?? data.active ?? undefined,
      },
    };
  }

  if (functionName === 'secciones-crear') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'crear-seccion',
        nombre: data.nombre || '',
        grado: data.grado ?? Number(data.grado_id || 0),
        letra: data.letra || '',
        anio_escolar_id: data.anio_escolar_id || data.anioId || data.id_anio || data.anio_id || null,
      },
    };
  }

  if (functionName === 'secciones-editar') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'editar-seccion',
        id_seccion: data.id_seccion || data.seccion_id || data.id || null,
        nombre: data.nombre || '',
        grado: data.grado ?? Number(data.grado_id || 0),
        letra: data.letra || '',
        anio_escolar_id: data.anio_escolar_id || data.anioId || data.id_anio || data.anio_id || null,
      },
    };
  }

  if (functionName === 'secciones-asignar-docente' || functionName === 'secciones-cambiar-docente') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'asignar-docente',
        p_id_seccion: data.id_seccion || data.seccion_id || data.seccionId || null,
        p_id_materia: data.id_materia || data.materia_id || data.materiaId || null,
        p_id_docente: data.id_docente || data.docente_id || data.docenteId || data.nuevo_docente_id || data.nuevoDocenteId || null,
      },
    };
  }

  if (functionName === 'secciones-listar-materias') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'listar-materias-seccion',
        p_id_seccion: data.id_seccion || data.seccion_id || data.seccionId || null,
      },
    };
  }

  if (functionName === 'secciones-agregar-materia') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'asignar-materia',
        p_id_seccion: data.id_seccion || data.seccion_id || data.seccionId || null,
        p_id_materia: data.id_materia || data.materia_id || data.materiaId || null,
      },
    };
  }

  if (functionName === 'secciones-quitar-materia') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'asignar-materia',
        p_id_seccion: data.id_seccion || data.seccion_id || data.seccionId || null,
        p_id_materia: data.id_materia || data.materia_id || data.materiaId || null,
      },
    };
  }

  if (functionName === 'secciones-clonar-otro-anio') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'clonar-seccion-otro-anio',
        id_seccion: data.id_seccion || data.seccion_id || data.seccionId || null,
        anio_destino: data.anio_destino || data.anioDestino || data.anio_destino_id || null,
      },
    };
  }

  if (functionName === 'secciones-toggle') {
    const data = payload || {};
    return {
      functionName: 'modulo-secciones',
      body: {
        action: 'toggle-seccion',
        id_seccion: data.id_seccion || data.seccion_id || data.id || null,
      },
    };
  }

  if (functionName === 'modulo-secciones') {
    const data = payload || {};
    if (data && typeof data === 'object' && data.action) {
      return { functionName: 'modulo-secciones', body: data };
    }
  }

  if (functionName === 'listar-estudiantes') {
    return { functionName: 'modulo-estudiantes', body: { action: 'listar', data: payload || {} } };
  }

  if (functionName === 'inscribir-estudiante') {
    return { functionName: 'modulo-estudiantes', body: { action: 'inscribir', data: payload || {} } };
  }

  if (functionName === 'cambiar-seccion') {
    return { functionName: 'modulo-estudiantes', body: { action: 'cambiar_seccion', data: payload || {} } };
  }

  if (functionName === 'promover-estudiante') {
    return { functionName: 'modulo-estudiantes', body: { action: 'promover', data: payload || {} } };
  }

  if (functionName === 'repetir-grado') {
    return { functionName: 'modulo-estudiantes', body: { action: 'repetir', data: payload || {} } };
  }

  if (functionName === 'retirar-estudiante') {
    return { functionName: 'modulo-estudiantes', body: { action: 'retirar', data: payload || {} } };
  }

  if (functionName === 'modulo-notas' || functionName === 'modulo-evaluaciones') {
    const data = payload || {};
    if (data && typeof data === 'object' && data.action) {
      const targetFunction = ['configurar-planilla', 'registrar-planilla', 'corregir-individual', 'obtener-planilla-llenada', 'verificar-completitud-notas'].includes(data.action)
        ? 'modulo-notas'
        : 'modulo-evaluaciones';
      return { functionName: targetFunction, body: data };
    }
  }

  return { functionName, body: payload };
};

const originalInvoke = client.functions.invoke.bind(client.functions);
client.functions.invoke = async (functionName, options = {}) => {
  const mapped = mapLegacyCall(functionName, options.body);
  const normalizedOptions = { ...options, body: mapped.body };
  normalizedOptions.method = 'POST';
  normalizedOptions.headers = await getAuthHeaders(normalizedOptions.headers || {});
  normalizedOptions.headers.set('Content-Type', 'application/json');

  try {
    const response = await originalInvoke(mapped.functionName, normalizedOptions);
    if (response?.error) {
      throw response.error;
    }
    return response;
  } catch (error) {
    let parsedBody = null;
    const details = error?.details || error?.message || '';

    if (typeof details === 'string' && details) {
      try {
        parsedBody = JSON.parse(details);
      } catch (parseError) {
        parsedBody = details;
      }
    }

    if (error?.context?.body) {
      parsedBody = error.context.body;
    }

    const message = parsedBody && typeof parsedBody === 'object' && parsedBody.error
      ? parsedBody.error
      : parsedBody || error?.message || `La función ${mapped.functionName} devolvió un error`;

    const wrappedError = new Error(message);
    wrappedError.status = error?.status || error?.statusCode || null;
    wrappedError.body = parsedBody;
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const match = url.match(/\/functions\/v1\/([^/?#]+)/);

  if (match) {
    const legacyName = decodeURIComponent(match[1]);
    const mapped = mapLegacyCall(legacyName, init?.body);
    const headers = await getAuthHeaders(init?.headers || {});
    headers.set('Content-Type', 'application/json');

    const mappedUrl = url.replace(`/functions/v1/${legacyName}`, `/functions/v1/${mapped.functionName}`);
    const mappedInit = {
      ...init,
      method: 'POST',
      headers,
      body: JSON.stringify(mapped.body),
    };

    const response = await originalFetch(mappedUrl, mappedInit);
    if (!response.ok) {
      throw await enrichFunctionError(response, mapped.functionName);
    }
    return response;
  }

  return originalFetch(input, init);
};

// Exponerlo como supabase global
window.supabase = client;
