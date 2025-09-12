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
  res.render('dashboard', { activePage: 'home' }); 
});

app.get('/chat', (req, res) => {
  res.render('chat', { activePage: 'chat' }); 
});

app.get('/tareas', (req, res) => {
  res.render('tareas', { activePage: 'tareas' }); 
});

app.get('/recompensas', (req, res) => {
  res.render('recompensas', { activePage: 'recompensas' });
});

app.get('/torneo', (req, res) => {
  res.render('torneo', { activePage: 'torneo' });
});

app.get('/login', (req, res) => {
  res.render('login');
});