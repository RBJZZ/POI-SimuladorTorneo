// Función para mostrar la pantalla de registro
function showRegister() {
  document.getElementById('login-box').style.display = 'none';  // Oculta la pantalla de login
  document.getElementById('register-box').style.display = 'block';  // Muestra la pantalla de registro
}

// Función para mostrar la pantalla de login
function showLogin() {
  document.getElementById('login-box').style.display = 'block';  // Muestra la pantalla de login
  document.getElementById('register-box').style.display = 'none';  // Oculta la pantalla de registro
}