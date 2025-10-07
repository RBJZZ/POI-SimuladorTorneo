const express = require('express');
const path = require('path');
const pool = require('./database');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

app.use(session({
  secret: 'hr/A(-zKn/b$dq%3HtWn?6HE?%1[J&',
  resave: false,
  saveUninitialized: false,
  // cookie: { secure: true } // Solo usar con HTTPS
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());
const PORT = 3000; 

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));

// MIDDLEWARES
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); 
  }
  res.redirect('/login'); 
}

// ENDPOINT DE LOGIN

app.post('/auth/login', async(req, res)=> {
  const {email, password}=req.body;
  
  if(!email || !password){
    return res.redirect('login');
  }

  try{
    const [rows]=await pool.execute('SELECT*FROM users WHERE email = ?', [email]);

    if(rows.length===0){
      console.log('Intento de login fallido, el usuario no existe.');
      return res.redirect('/login');
    }

    const user=rows[0];

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (passwordMatches) {

      console.log('¡Login exitoso para:', user.email);
      
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email
      };

      res.redirect('/');
    }else{
      console.log('Intento de login falldo, contraseña incorrecta.')
      res.redirect('/login');
    }
  }catch(error){
    console.error('Error en el proceso de login:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

//ENDPOINT DE REGISTRO

app.post('/auth/register', async (req,res)=> {

  const { username, email, password, confirmPassword } = req.body;

  if(!username || !email || !password || !confirmPassword) {
    return res.redirect('login');
  }

  if(password!== confirmPassword){
    console.log('Error de registro: Las contraseñas no coinciden.');
    return res.redirect('/login');
  }

  try{
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
  

    if(existingUsers.length > 0){
      console.log('Error de registro: El email o username ya está en uso.');
      return res.redirect ('/login');
    }

    const saltRounds =10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?,?,?)',
      [username, email, hashedPassword]
    );

    console.log(`¡Nuevo usuario registrado: ${username}!`);

    res.redirect('/login');
  }catch(error){
    console.error('Error en el proceso de registro:', error);
    res.status(500).send('Error interno del servidor');
  }

});

// NAVBAR

app.get('/', isAuthenticated, (req, res) => {
  res.render('dashboard', { activePage: 'home' }); 
});

app.get('/chat', isAuthenticated, (req, res) => {
  res.render('chat', { activePage: 'chat' }); 
});

app.get('/tareas', isAuthenticated, (req, res) => {
  res.render('tareas', { activePage: 'tareas' }); 
});

app.get('/recompensas', isAuthenticated, (req, res) => {
  res.render('recompensas', { activePage: 'recompensas' });
});

app.get('/torneo', isAuthenticated, (req, res) => {
  res.render('torneo', { activePage: 'torneo' });
});

app.get('/perfil', isAuthenticated, (req, res) => {
  res.render('perfil', { 
    activePage: 'perfil',
    user: req.session.user
  }); 
});

app.get('/login', (req, res) => {
  res.render('login');
});

