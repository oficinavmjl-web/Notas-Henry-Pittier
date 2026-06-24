function renderizarHistorialAcademico(lista) {
  const tbody = document.getElementById("tablaHistorialAcademico");
  tbody.innerHTML = "";

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-3">
          No hay historial académico registrado.
        </td>
      </tr>`;
    return;
  }

  lista.forEach(i => {
    const badge = {
      activo: `<span class="badge bg-success">Activo</span>`,
      promovido: `<span class="badge bg-primary">Promovido</span>`,
      retirado: `<span class="badge bg-danger">Retirado</span>`,
      reprobado: `<span class="badge bg-warning text-dark">Reprobado</span>`
    }[i.estado] || i.estado;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i.anios_escolares?.nombre || "-"}</td>
      <td>${i.secciones?.grado_id || "-"}</td>
      <td>${i.secciones?.nombre || "-"}</td>
      <td>${badge}</td>
      <td>${new Date(i.created_at).toLocaleDateString()}</td>
      <td>${i.updated_at ? new Date(i.updated_at).toLocaleDateString() : "-"}</td>
      <td>${i.promedio_final ?? "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}

