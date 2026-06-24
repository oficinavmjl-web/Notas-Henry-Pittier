function marcarError(input, mensaje) {
  input.classList.add("is-invalid");
  input.nextElementSibling?.remove();
  const div = document.createElement("div");
  div.className = "invalid-feedback";
  div.textContent = mensaje;
  input.parentNode.appendChild(div);
  return false;
}

function limpiarErroresEstudiantes() {
  document.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
  document.querySelectorAll(".invalid-feedback").forEach(el => el.remove());
}

async function confirmarAccion(mensaje) {
  return confirm(mensaje);
}
