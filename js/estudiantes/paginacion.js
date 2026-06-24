function renderizarPaginacionEstudiantes(total) {
  const ul = document.getElementById("paginacionEstudiantes");
  ul.innerHTML = "";

  const totalPaginas = Math.ceil(total / window._tamanoPagina);

  for (let i = 1; i <= totalPaginas; i++) {
    const li = document.createElement("li");
    li.className = "page-item " + (i === window._paginaActual ? "active" : "");
    li.innerHTML = `<a class="page-link" style="cursor:pointer">${i}</a>`;
    li.onclick = () => {
      window._paginaActual = i;
      cargarEstudiantes();
    };
    ul.appendChild(li);
  }
}
