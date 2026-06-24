
async function abrirMaterias(idSeccion) {
  limpiarErrores(); // ← IMPORTANTE

  const sec = window._secciones.find(s => s.id_seccion === idSeccion);
  window._materiasSeccionSeccionId = idSeccion;
  if (!sec) return;
  
  document.getElementById("materiasInfoSeccion").innerText =
    `${sec.nombre} — ${sec.grado}° ${sec.letra}`;

  const data = await API.secciones.listarMaterias(idSeccion);
  window._materiasSeccion = Array.isArray(data) ? data : data?.materias || [];

  const tbody = document.getElementById("tablaMateriasSeccion");
  tbody.innerHTML = "";

  window._materiasSeccion.forEach(m => {
    tbody.innerHTML += `
      <tr>
        <td>${m.nombre_materia}</td>
        <td>${m.docente_nombre ?? "<span class='text-muted'>Sin docente</span>"}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="abrirAsignarDocente(${sec.id_seccion}, ${m.id_materia})">
            Asignar / cambiar docente
          </button>

          <button class="btn btn-sm btn-outline-danger" onclick="quitarMateria(${sec.id_seccion}, ${m.id_materia})">
            Quitar materia
          </button>
        </td>
      </tr>
    `;
  });

  new bootstrap.Modal(document.getElementById("modalMaterias")).show();
}


function quitarMateria(idSeccion, idMateria) {
  confirmarAccion(
    "¿Seguro que deseas quitar esta materia de la sección?",
    async () => {
      const data = await API.secciones.quitarMateria(idSeccion, idMateria);

      if (data?.error) {
        alert("Error: " + data.error);
        return;
      }

      abrirMaterias(idSeccion);
    }
  );
}
