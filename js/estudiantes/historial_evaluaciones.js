function renderizarHistorialEvaluaciones(lista) {
  const cont = document.getElementById("contenedorHistorialEvaluaciones");
  cont.innerHTML = "";

  if (!lista || lista.length === 0) {
    cont.innerHTML = `
      <div class="text-muted text-center py-3">
        No hay evaluaciones registradas.
      </div>`;
    return;
  }

  // Agrupar por lapso
  const lapsos = {};
  lista.forEach(n => {
    const lapso = n.evaluaciones_lapsos.lapso_id;
    if (!lapsos[lapso]) lapsos[lapso] = [];
    lapsos[lapso].push(n);
  });

  Object.keys(lapsos).forEach(lapso => {
    const grupo = lapsos[lapso];

    const div = document.createElement("div");
    div.classList.add("mb-4");

    div.innerHTML = `
      <h6 class="fw-bold">Lapso ${lapso}</h6>
      <table class="table table-bordered table-striped">
        <thead>
          <tr>
            <th>Materia</th>
            <th>Evaluación</th>
            <th>Técnica</th>
            <th>Instrumento</th>
            <th>Porcentaje</th>
            <th>Nota</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${grupo.map(n => `
            <tr>
              <td>${n.evaluaciones_lapsos.materias.nombre}</td>
              <td>${n.evaluaciones_lapsos.nombre}</td>
              <td>${n.evaluaciones_lapsos.tecnica}</td>
              <td>${n.evaluaciones_lapsos.instrumento}</td>
              <td>${n.evaluaciones_lapsos.porcentaje}%</td>
              <td>${n.nota}</td>
              <td>${new Date(n.evaluaciones_lapsos.fecha).toLocaleDateString()}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    cont.appendChild(div);
  });
}
