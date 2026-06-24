async function abrirDetallesEstudiante(id_estudiante) {

  // ============================
  // 1. CARGAR DATOS DEL ESTUDIANTE
  // ============================
  const { data, error } = await supabase
    .from("estudiantes")
    .select(`
      *,
      inscripciones (
        id_inscripcion,
        estado,
        created_at,
        updated_at,
        promedio_final,
        seccion_id,
        anio_escolar_id,
        secciones (nombre, grado_id),
        anios_escolares (nombre)
      )
    `)
    .eq("id_estudiante", id_estudiante)
    .single();

  if (error) {
    alert("Error cargando detalles del estudiante");
    return;
  }

  // Renderizar datos personales
  renderizarDetallesEstudiante(data);

  // Renderizar historial de inscripciones
  renderizarHistorialInscripciones(data.inscripciones);

  // Renderizar historial académico completo
  renderizarHistorialAcademico(data.inscripciones);


  // ============================
  // 2. CARGAR HISTORIAL DE EVALUACIONES POR LAPSO
  // ============================
  const { data: dataEvaluaciones } = await supabase
    .from("evaluaciones_notas")
    .select(`
      nota,
      observacion,
      evaluaciones_lapsos (
        nombre,
        tecnica,
        instrumento,
        porcentaje,
        fecha,
        lapso_id,
        materias (nombre),
        secciones (nombre)
      )
    `)
    .eq("estudiante_id", id_estudiante)
    .order("lapso_id", { foreignTable: "evaluaciones_lapsos" })
    .order("fecha", { foreignTable: "evaluaciones_lapsos" });

  renderizarHistorialEvaluaciones(dataEvaluaciones);


  // ============================
  // 3. CARGAR PROMEDIOS POR LAPSO
  // ============================
  const inscripcionActiva = data.inscripciones.find(i => i.estado === "activo");

  let promedios = null;

  if (inscripcionActiva) {
    const { data: resultadoPromedios } = await supabase.rpc(
      "calcular_promedio_estudiante",
      {
        p_estudiante: id_estudiante,
        p_inscripcion: inscripcionActiva.id_inscripcion
      }
    );

    promedios = resultadoPromedios;
  }

  renderizarPromediosLapso(promedios);


  // ============================
  // 4. MOSTRAR MODAL
  // ============================
  new bootstrap.Modal("#modalDetallesEstudiante").show();
}



function renderizarDetallesEstudiante(est) {
  // Calcular edad
  let edad = "-";
  if (est.fecha_nacimiento) {
    const nacimiento = new Date(est.fecha_nacimiento);
    const hoy = new Date();
    edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  }

  detCedula.textContent = est.cedula;
  detNombre.textContent = `${est.nombres} ${est.apellidos}`;
  detEdad.textContent = edad;
  detSexo.textContent = est.sexo || "-";
  detEstado.innerHTML = est.activo
    ? `<span class="badge bg-success">Activo</span>`
    : `<span class="badge bg-secondary">Inactivo</span>`;
  detDireccion.textContent = est.direccion || "-";
  detTelefono.textContent = est.telefono || "-";
  detRepresentante.textContent = est.representante || "-";
  detTelefonoRepresentante.textContent = est.telefono_representante || "-";
}

function renderizarHistorialInscripciones(lista) {
  const tbody = document.getElementById("tablaHistorialInscripciones");
  tbody.innerHTML = "";

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-3">
          No hay inscripciones registradas.
        </td>
      </tr>`;
    return;
  }

  lista.forEach((i) => {
    const badge =
      {
        activo: `<span class="badge bg-success">Activo</span>`,
        promovido: `<span class="badge bg-primary">Promovido</span>`,
        retirado: `<span class="badge bg-danger">Retirado</span>`,
        reprobado: `<span class="badge bg-warning text-dark">Reprobado</span>`,
      }[i.estado] || i.estado;


    //barra de acciones
    const acciones = i.estado === "activo"
      ? `
    <button class="btn btn-sm btn-primary me-1"
      onclick="abrirPromocionEstudiante(${i.id_inscripcion}, ${i.seccion_id}, ${i.anio_escolar_id})">
      Promover
    </button>

    <button class="btn btn-sm btn-warning me-1"
      onclick="abrirRepetirGrado(${i.id_inscripcion}, ${i.seccion_id}, ${i.anio_escolar_id})">
      Repetir grado
    </button>

    <button class="btn btn-sm btn-info me-1"
      onclick="abrirCambioSeccion(${i.id_inscripcion}, ${i.seccion_id}, ${i.anio_escolar_id})">
      Cambiar sección
    </button>

    <button class="btn btn-sm btn-danger"
      onclick="retirarEstudiante(${i.id_inscripcion})">
      Retirar
    </button>
  `
      : `<button class="btn btn-sm btn-secondary" disabled>Sin acciones</button>`;

    //fin barra de acciones
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i.anios_escolares?.nombre || "-"}</td>
      <td>${i.secciones?.grado_id || "-"}</td>
      <td>${i.secciones?.nombre || "-"}</td>
      <td>${badge}</td>
      <td>${new Date(i.created_at).toLocaleDateString()}</td>
      <td>${acciones}</td>
    `;

    tbody.appendChild(tr);
  });
}
