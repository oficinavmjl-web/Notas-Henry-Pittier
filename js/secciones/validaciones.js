//Funciones de Validaciones:
function validarCrear() {
  limpiarErrores();

  const nombre = document.getElementById("crearNombre").value.trim();
  const grado = document.getElementById("crearGrado").value.trim();
  const letra = document.getElementById("crearLetra").value.trim();
  const anio = document.getElementById("crearAnio").value;

  if (!nombre) {
    marcarError("crearNombre", "El nombre es obligatorio");
    return "El nombre es obligatorio";
  }

  if (!grado || isNaN(grado) || grado < 1 || grado > 11) {
    marcarError("crearGrado", "Debe ser un número entre 1 y 11");
    return "El grado debe ser un número entre 1 y 11";
  }

  if (!letra || letra.length !== 1) {
    marcarError("crearLetra", "Debe ser un solo carácter");
    return "La letra debe ser un solo carácter";
  }

  if (!anio) {
    marcarError("crearAnio", "Debe seleccionar un año escolar");
    return "Debe seleccionar un año escolar";
  }

  return null;
}

function validarEditar() {
  limpiarErrores();

  const nombre = document.getElementById("editarNombre").value.trim();
  const grado = document.getElementById("editarGrado").value.trim();
  const letra = document.getElementById("editarLetra").value.trim();
  const anio = document.getElementById("editarAnio").value;

  if (!nombre) {
    marcarError("editarNombre", "El nombre es obligatorio");
    return "El nombre es obligatorio";
  }

  if (!grado || isNaN(grado) || grado < 1 || grado > 11) {
    marcarError("editarGrado", "Debe ser un número entre 1 y 11");
    return "El grado debe ser un número entre 1 y 11";
  }

  if (!letra || letra.length !== 1) {
    marcarError("editarLetra", "Debe ser un solo carácter");
    return "La letra debe ser un solo carácter";
  }

  if (!anio) {
    marcarError("editarAnio", "Debe seleccionar un año escolar");
    return "Debe seleccionar un año escolar";
  }

  return null;
}

function validarClonar() {
  limpiarErrores();

  const nombre = document.getElementById("clonarNombre").value.trim();
  const letra = document.getElementById("clonarLetra").value.trim();

  if (!nombre) {
    marcarError("clonarNombre", "El nombre nuevo es obligatorio");
    return "El nombre nuevo es obligatorio";
  }

  if (!letra || letra.length !== 1) {
    marcarError("clonarLetra", "La letra nueva debe ser un solo carácter");
    return "La letra nueva debe ser un solo carácter";
  }

  return null;
}

function validarAgregarMateria() {
  limpiarErrores();

  const materia = document.getElementById("agregarMateriaSelect").value;

  if (!materia) {
    marcarError("agregarMateriaSelect", "Debe seleccionar una materia");
    return "Debe seleccionar una materia";
  }

  return null;
}

function validarAsignarDocente() {
  limpiarErrores();

  const docente = document.getElementById("asignarDocenteSelect").value;

  if (!docente) {
    marcarError("asignarDocenteSelect", "Debe seleccionar un docente");
    return "Debe seleccionar un docente";
  }

  return null;
}