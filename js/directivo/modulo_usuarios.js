(async () => {
  const token = window.tokenGlobal;

  const { data: rawUsuarios } = await supabase.functions.invoke(
    "users-list_users",
    {
      body: { page: 1, per_page: 50 },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const usuarios = JSON.parse(rawUsuarios);

  const contenedor = document.getElementById("usuariosTabla");

  const tabla = document.createElement("table");
  tabla.className = "table table-striped table-sm";

  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Username</th>
        <th>Nombres</th>
        <th>Apellidos</th>
        <th>Cédula</th>
        <th>Activo</th>
        <th>Rol</th>
      </tr>
    </thead>
    <tbody>
      ${usuarios.items
        .map(
          (u) => `
        <tr>
          <td>${u.username}</td>
          <td>${u.nombres}</td>
          <td>${u.apellidos}</td>
          <td>${u.cedula ?? "—"}</td>
          <td>${u.activo ? "Sí" : "No"}</td>
          <td>${u.rol ?? "—"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;

  contenedor.innerHTML = "";
  contenedor.appendChild(tabla);
})();
