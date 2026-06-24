
function marcarError(id, mensaje = "") {
  const input = document.getElementById(id);
  input.classList.add("is-invalid");

  let feedback = input.nextElementSibling;
  if (!feedback || !feedback.classList.contains("invalid-feedback")) {
    feedback = document.createElement("div");
    feedback.classList.add("invalid-feedback");
    input.insertAdjacentElement("afterend", feedback);
  }

  feedback.innerText = mensaje;
}

function limpiarErrores() {
  document.querySelectorAll(".is-invalid").forEach(el => {
    el.classList.remove("is-invalid");
  });
  document.querySelectorAll(".invalid-feedback").forEach(el => {
    el.remove();
  });
}

function confirmarAccion(mensaje, callback) {
  document.getElementById("confirmarMensaje").innerText = mensaje;

  const btnAceptar = document.getElementById("confirmarAceptar");

  // Clonar botón para limpiar listeners previos
  const nuevoBtn = btnAceptar.cloneNode(true);
  btnAceptar.parentNode.replaceChild(nuevoBtn, btnAceptar);

  nuevoBtn.addEventListener("click", () => {
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalConfirmar"));
    modal.hide();
    callback();
  });

  new bootstrap.Modal(document.getElementById("modalConfirmar")).show();
}
