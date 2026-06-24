// /public/js/secciones/ordenamiento.js

window._ordenActual = { columna: null, direccion: 1 }; 
// direccion: 1 = asc, -1 = desc

function ordenarSecciones(columna) {
  // Alternar dirección si se hace clic en la misma columna
  if (window._ordenActual.columna === columna) {
    window._ordenActual.direccion *= -1;
  } else {
    window._ordenActual = { columna, direccion: 1 };
  }

  const dir = window._ordenActual.direccion;

  // Ordenar
  window._seccionesFiltradas.sort((a, b) => {
    let x = a[columna];
    let y = b[columna];

    if (typeof x === "string") x = x.toLowerCase();
    if (typeof y === "string") y = y.toLowerCase();

    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return 0;
  });

  actualizarIconosOrdenamiento();
  renderizarTabla();
}

function actualizarIconosOrdenamiento() {
  const columnas = ["nombre", "grado", "letra", "activo"];

  // Limpiar iconos
  columnas.forEach(col => {
    document.getElementById(`icono-${col}`).innerHTML = "";
  });

  if (!window._ordenActual.columna) return;

  const col = window._ordenActual.columna;
  const dir = window._ordenActual.direccion;

  const icono = dir === 1 ? "↑" : "↓";

  document.getElementById(`icono-${col}`).innerHTML = icono;
}
