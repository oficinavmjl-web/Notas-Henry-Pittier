// ============================================================================
// AUTENTICACIÓN - Login y Gestión de Sesión
// ============================================================================

// Obtener rol principal del usuario
async function obtenerRolPrincipal(userId) {
  try {
    // 1) Buscar en la tabla user_roles por user_id (esquema real usa `id_rol`)
    const { data: urData, error: urError } = await supabase
      .from('user_roles')
      .select('id_rol')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (urError || !urData) {
      return { rol_principal: '', role_id: null, todos_roles: [] };
    }

    const idRol = urData.id_rol;

    // 2) Obtener el nombre del rol desde la tabla `rol`
    const { data: rData, error: rError } = await supabase
      .from('rol')
      .select('nombre')
      .eq('id_rol', idRol)
      .limit(1)
      .single();

    if (rError || !rData) {
      return { rol_principal: '', role_id: idRol || null, todos_roles: [] };
    }

    // 3) Transformar el nombre de la BD a la forma esperada por el frontend
    //    Ej: 'superadmin' -> 'Superadmin', 'control_estudios' -> 'Control_estudios'
    const nombreBD = (rData.nombre || '').trim();
    const rolPrincipal = nombreBD
      ? nombreBD
          .split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('_')
      : '';

    return {
      rol_principal: rolPrincipal,
      role_id: idRol || null,
      todos_roles: nombreBD ? [nombreBD, rolPrincipal] : [],
    };
  } catch (err) {
    console.warn('No se pudo obtener rol, asignando por defecto:', err);
    return { rol_principal: '', role_id: null, todos_roles: [] };
  }
}

// Manejador del formulario de login
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const alertBox = document.getElementById("alert");

  if (!alertBox) {
    console.error("Elemento alert no encontrado");
    return;
  }

  alertBox.classList.add("d-none");

  // 1. Login en Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alertBox.className = "alert alert-danger";
    alertBox.textContent = `Error de autenticación: ${error.message}`;
    alertBox.classList.remove("d-none");
    console.error("Error login:", error);
    return;
  }

  if (!data?.session?.access_token || !data?.user) {
    alertBox.className = "alert alert-danger";
    alertBox.textContent = "No se obtuvo token de sesión";
    alertBox.classList.remove("d-none");
    return;
  }

  // 2. Obtener rol principal del usuario
  const rolData = await obtenerRolPrincipal(data.user.id);

  // 3. Guardar sesión
  sessionAPI.guardarSesion(data.user, rolData || {});

  // 4. Redirigir según rol principal
  nav.redirigirPorRol();
});
