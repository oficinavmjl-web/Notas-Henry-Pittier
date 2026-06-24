// /public/js/secciones/busqueda.js

function resaltar(texto, busqueda) {
  if (!busqueda) return texto;

  const regex = new RegExp(`(${busqueda})`, "gi");
  return texto.replace(regex, `<mark>$1</mark>`);
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("buscarSeccion");
  if (!input) return;

  input.addEventListener("input", () => {
    filtrarSecciones(input.value.trim().toLowerCase());
  });
});

function filtrarSecciones(texto) {
  const tbody = document.getElementById("tablaSecciones");
  tbody.innerHTML = "";

  const lista = window._secciones.filter(sec => {
    return (
      sec.nombre.toLowerCase().includes(texto) ||
      String(sec.grado).includes(texto) ||
      sec.letra.toLowerCase().includes(texto)
    );
  });

  lista.forEach(sec => {
    const nombreRes = resaltar(sec.nombre, texto);
    const gradoRes = resaltar(String(sec.grado), texto);
    const letraRes = resaltar(sec.letra, texto);

    tbody.innerHTML += `
      <tr>
        <td>${nombreRes}</td>
        <td>${gradoRes}</td>
        <td>${letraRes}</td>
        <td>
          <span class="badge ${sec.activo ? "bg-success" : "bg-danger"}">
            ${sec.activo ? "Activa" : "Inactiva"}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-info" onclick="abrirMaterias(${sec.id_seccion})">
            Materias
          </button>

          <button class="btn btn-sm btn-warning" onclick="abrirEditar(${sec.id_seccion})">
            Editar
          </button>

          <button class="btn btn-sm btn-secondary" onclick="abrirClonar(${sec.id_seccion})">
            Clonar
          </button>

          <button class="btn btn-sm btn-dark" onclick="toggleSeccion(${sec.id_seccion})">
            ${sec.activo ? "Desactivar" : "Activar"}
          </button>
        </td>
      </tr>
    `;
  });

  window._seccionesFiltradas = lista;
window._paginaActual = 1;
renderizarTabla();

}

