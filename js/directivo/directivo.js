// -------------------------------------------------------------
// Verificar sesión y rol al cargar
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const { data: session } = await supabase.auth.getSession();

  if (!session.session) {
    window.location.href = "login.html";
    return;
  }

  const token = session.session.access_token;
  const userId = session.session.user.id;

  window.tokenGlobal = token;

  const { data: rawUserData, error } = await supabase.functions.invoke(
    "users-get_user",
    {
      body: { user_id: userId },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (error || !rawUserData) {
    alert("Error verificando rol");
    window.location.href = "login.html";
    return;
  }

  const userData = JSON.parse(rawUserData);

  if (userData.rol !== "directivo" && userData.rol !== "superadmin") {
    alert("Acceso denegado");
    window.location.href = "login.html";
    return;
  }

  await cargarModulo("dashboard.html");
  await cargarDashboard(token);
});

// -------------------------------------------------------------
// Cargar módulo HTML dinámico
// -------------------------------------------------------------
async function cargarModulo(pagina) {
  const res = await fetch(`./modulos/${pagina}`);
  const html = await res.text();
  const container = document.getElementById("moduloContenido");
  container.innerHTML = html;

  const scriptTags = Array.from(container.querySelectorAll("script"));
  for (const tag of scriptTags) {
    const script = document.createElement("script");
    if (tag.src) {
      script.src = tag.src;
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    } else {
      script.textContent = tag.textContent;
    }
    document.body.appendChild(script);
    tag.remove();
  }
}

// -------------------------------------------------------------
// Navegación del sidebar
// -------------------------------------------------------------
document.getElementById("menuDashboard").addEventListener("click", async () => {
  document.getElementById("tituloModulo").innerText = "Dashboard";
  await cargarModulo("dashboard.html");
  await cargarDashboard(tokenGlobal);
});

document.getElementById("menuUsuarios").addEventListener("click", async () => {
  document.getElementById("tituloModulo").innerText = "Gestión de Usuarios";
  await cargarModulo("usuarios.html");
});

document.getElementById("menuSecciones").addEventListener("click", async () => {
  document.getElementById("tituloModulo").innerText = "Gestión de Secciones";
  await cargarModulo("secciones.html");
});

document.getElementById("menuPeriodos").addEventListener("click", async () => {
  document.getElementById("tituloModulo").innerText = "Gestión de Períodos Académicos";
  await cargarModulo("periodos.html");
});

// -------------------------------------------------------------
// Logout
// -------------------------------------------------------------
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

// -------------------------------------------------------------
// Dashboard (usa Edge Functions existentes)
// -------------------------------------------------------------
async function cargarDashboard(token) {
  const { data: rawUsuarios } = await supabase.functions.invoke(
    "users-list_users",
    {
      body: { page: 1, per_page: 1, activo_filter: true },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const usuarios = JSON.parse(rawUsuarios);
  document.getElementById("countUsuarios").textContent =
    usuarios.pagination.total;

  const { data: rawDocentes } = await supabase.functions.invoke(
    "users-list_users",
    {
      body: { page: 1, per_page: 1, rol_filter: "docente" },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const docentes = JSON.parse(rawDocentes);
  document.getElementById("countDocentes").textContent =
    docentes.pagination.total;

  document.getElementById("countEstudiantes").textContent = "—";
}
