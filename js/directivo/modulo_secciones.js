(async () => {
  const token = window.tokenGlobal;

  const { data: rawActivo, error: errorActivo } = await supabase.functions.invoke(
    "periodos-get_activo",
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (errorActivo) {
    document.getElementById("seccionesTabla").innerHTML =
      `<div class="alert alert-danger">Error cargando secciones</div>`;
    return;
  }

  const activoData = JSON.parse(rawActivo);
  const idAnio = activoData?.anio?.id_anio;

  if (!idAnio) {
    document.getElementById("seccionesTabla").innerHTML =
      `<div class="alert alert-warning">No hay año escolar activo</div>`;
    return;
  }

  const res = await fetch(`/functions/v1/secciones-listar?anio_escolar_id=${encodeURIComponent(
    idAnio
  )}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const secciones = await res.json();

  const contenedor = document.getElementById("seccionesTabla");

  const tabla = document.createElement("table");
  tabla.className = "table table-striped table-sm";

  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Año</th>
        <th>Sección</th>
        <th>Mención</th>
        <th>Turno</th>
        <th>Activo</th>
      </tr>
    </thead>
    <tbody>
      ${secciones.items
        .map(
          (s) => `
        <tr>
          <td>${s.anio_escolar_nombre ?? "—"}</td>
          <td>${s.nombre}</td>
          <td>${s.mencion ?? "—"}</td>
          <td>${s.turno ?? "—"}</td>
          <td>${s.activo ? "Sí" : "No"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;

  contenedor.innerHTML = "";
  contenedor.appendChild(tabla);
})();
