function renderizarPromediosLapso(data) {
  const div = document.getElementById("promediosPorLapso");

  div.innerHTML = `
    <ul class="list-group">
      <li class="list-group-item">Lapso 1: <strong>${data.lapso1}</strong></li>
      <li class="list-group-item">Lapso 2: <strong>${data.lapso2}</strong></li>
      <li class="list-group-item">Lapso 3: <strong>${data.lapso3}</strong></li>
      <li class="list-group-item bg-light">Promedio final: <strong>${data.promedio_final}</strong></li>
    </ul>
  `;
}
