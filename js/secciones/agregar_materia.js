
async function abrirAgregarMateria(idSeccion) {
  limpiarErrores(); // ← IMPORTANTE

  const sec = window._secciones.find(s => s.id_seccion === idSeccion);
  if (!sec) return;

  document.getElementById("agregarIdSeccion").value = idSeccion;
  document.getElementById("agregarInfoSeccion").innerText =
    `${sec.nombre} — ${sec.grado}° ${sec.letra}`;

  const { data, error } = await supabase
    .from("materias")
    .select("id_materia, nombre")
    .order("nombre", { ascending: true });

  if (error) {
    alert("Error cargando materias");
    return;
  }

  const select = document.getElementById("agregarMateriaSelect");
  select.innerHTML = "";

  data.forEach(mat => {
    select.innerHTML += `
      <option value="${mat.id_materia}">
        ${mat.nombre}
      </option>
    `;
  });

  new bootstrap.Modal(document.getElementById("modalAgregarMateria")).show();
}


async function guardarAgregarMateria(event) {
  const btn = event.target;
  btn.disabled = true;

  const error = validarAgregarMateria();
  if (error) {
    alert(error);
    btn.disabled = false;
    return;
  }
  
  const body = {
    id_seccion: Number(document.getElementById("agregarIdSeccion").value),
    id_materia: Number(document.getElementById("agregarMateriaSelect").value)
  };

  try {
    const data = await API.secciones.agregarMateria(body.id_seccion, body.id_materia);

    if (data?.error) {
      alert("Error: " + data.error);
      return;
    }

    abrirMaterias(body.id_seccion);

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalAgregarMateria"));
    modal.hide();

  } finally {
    btn.disabled = false;
  }
}