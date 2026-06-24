// /public/js/secciones/paginacion.js

window._paginaActual = 1;
window._tamanoPagina = 10;

function cambiarTamanoPagina() {
  window._tamanoPagina = Number(document.getElementById("tamanoPagina").value);
  window._paginaActual = 1;
  renderizarTabla();
}

function cambiarPagina(nueva) {
  window._paginaActual = nueva;
  renderizarTabla();
}

function renderizarPaginacion(totalFilas) {
  const cont = document.getElementById("paginacionControles");
  const totalPaginas = Math.ceil(totalFilas / window._tamanoPagina);

  let html = `<nav><ul class="pagination mb-0">`;

  // Botón anterior
  html += `
    <li class="page-item ${window._paginaActual === 1 ? "disabled" : ""}">
      <button class="page-link" onclick="cambiarPagina(${window._paginaActual - 1})">Anterior</button>
    </li>
  `;

  // Números
  for (let i = 1; i <= totalPaginas; i++) {
    html += `
      <li class="page-item ${i === window._paginaActual ? "active" : ""}">
        <button class="page-link" onclick="cambiarPagina(${i})">${i}</button>
      </li>
    `;
  }

  // Botón siguiente
  html += `
    <li class="page-item ${window._paginaActual === totalPaginas ? "disabled" : ""}">
      <button class="page-link" onclick="cambiarPagina(${window._paginaActual + 1})">Siguiente</button>
    </li>
  `;

  html += `</ul></nav>`;

  cont.innerHTML = html;
}
