(async () => {
  const token = window.tokenGlobal;

  const { data: rawResult, error: errorResult } = await supabase.functions.invoke(
    "periodos-list_anios",
    {
      body: {},
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (errorResult) {
    document.getElementById("periodosTabla").innerHTML =
      `<div class="alert alert-danger">Error cargando períodos académicos</div>`;
    return;
  }

  const parsed = JSON.parse(rawResult);
  const periodos = parsed?.data || [];

  const contenedor = document.getElementById("periodosTabla");

  const tabla = document.createElement("table");
  tabla.className = "table table-striped table-sm";

  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Año escolar</th>
        <th>Activo</th>
      </tr>
    </thead>
    <tbody>
      ${periodos.items
        .map(
          (p) => `
        <tr>
          <td>${p.nombre}</td>
          <td>${p.anio_escolar_nombre ?? "—"}</td>
          <td>${p.activo ? "Sí" : "No"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;

  contenedor.innerHTML = "";
  contenedor.appendChild(tabla);
})();
