const express = require('express');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
const PORT = 3000; 

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('Dashboard y Home'); 
});

app.get('/chat', (req, res) => {
  res.render('Pantalla de Chat (Privado y Grupal)'); 
});

app.get('/tareas', (req, res) => {
  res.render('Pantalla de Gestión de Tareas'); 
});

app.get('/recompensas', (req, res) => {
  res.render('Pantalla de Recompensas');
});

app.get('/torneo', (req, res) => {
  res.render('Pantalla del Simulador de Torneo');
});