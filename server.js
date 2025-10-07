const express = require('express');
const path = require('path');
const pool = require('./database');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();

const sessionMiddleware = session({
  secret: 'hr/A(-zKn/b$dq%3HtWn?6HE?%1[J&',
  resave: false,
  saveUninitialized: false,
});

app.use(sessionMiddleware);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const httpServer = createServer(app);
const io = new Server(httpServer);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// MIDDLEWARES
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); 
  }
  res.redirect('/login'); 
}

// CHAT
io.on('connection', async (socket) => { // <-- 1. Añade async aquí
    const user = socket.request.session.user;
    if (!user) {
        console.log('Un usuario anónimo se conectó. Desconectando.');
        return socket.disconnect(true);
    }
    console.log(`Usuario conectado al chat: ${user.username} (ID: ${socket.id})`);
    socket.userId = user.id;
    socket.username = user.username;

    try {
        const [myGroups] = await pool.execute(
            `SELECT group_id FROM group_members WHERE user_id = ?`,
            [user.id]
        );
        myGroups.forEach(group => {
            // Unimos el socket a una sala con el ID del grupo
            socket.join(String(group.group_id));
            console.log(`Usuario ${socket.username} unido automáticamente a la sala ${group.group_id}`);
        });
    } catch (error) {
        console.error('Error al unir al usuario a sus salas:', error);
    }

    socket.on('join_room', async (roomId) => {
        
        console.log(`Usuario ${socket.username} activó la vista para la sala ${roomId}`);

        try {
            const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
            const onlineCount = clientsInRoom ? clientsInRoom.size : 0;
            const [rows] = await pool.execute('SELECT COUNT(*) as totalMembers FROM group_members WHERE group_id = ?', [roomId]);
            const totalMembers = rows[0].totalMembers;
            io.to(roomId).emit('room_status_update', { onlineCount, totalMembers });
        } catch (error) {
            console.error("Error al actualizar el estado de la sala:", error);
        }
    });

    socket.on('chat message', async (data) => {
    const { content, roomId } = data;
    if (!content.trim() || !roomId) return;
    
    try {
        await pool.execute(
            'INSERT INTO messages (sender_id, content, group_id) VALUES (?, ?, ?)',
            [socket.userId, content, roomId]
        );
        
        const messageData = {
            username: socket.username,
            content: content,
            timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            roomId: roomId
        };
        
        io.to(roomId).emit('chat message', messageData);

    } catch (error) {
        console.error('Error al guardar o emitir el mensaje:', error);
    }
});

    socket.on('request_room_history', async (roomId) => {
        try {
            const [history] = await pool.execute(
                `SELECT m.content, m.created_at, u.username 
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.group_id = ?
                 ORDER BY m.created_at ASC`,
                [roomId]
            );
            socket.emit('room_history', history);
        } catch (error) {
            console.error('Error al obtener el historial del chat:', error);
        }
    });

    socket.on('typing_start', ({ roomId }) => {
        socket.to(roomId).emit('user_typing_start', { roomId: roomId });
    });
    socket.on('typing_stop', ({ roomId }) => {
        socket.to(roomId).emit('user_typing_stop', { roomId: roomId });
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.username}`);
        socket.rooms.forEach(async (roomId) => {
            if (roomId !== socket.id) {
                try {
                    const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
                    const onlineCount = clientsInRoom ? clientsInRoom.size : 0;
                    const [rows] = await pool.execute('SELECT COUNT(*) as totalMembers FROM group_members WHERE group_id = ?', [roomId]);
                    const totalMembers = rows[0].totalMembers;
                    socket.to(roomId).emit('room_status_update', { onlineCount, totalMembers });
                } catch (error) {
                    console.error("Error al actualizar estado en disconnect:", error);
                }
            }
        });
    });
});

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

// CREATE GROUP CHAT

app.post('/chats/create-group', isAuthenticated, async (req, res) => {
  const { groupName, members } = req.body; 
  const creatorId = req.session.user.id;   

  if (!groupName || !members || members.length === 0) {
    return res.status(400).json({ message: 'El nombre del grupo y los miembros son requeridos.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [groupResult] = await connection.execute(
      'INSERT INTO `groups` (name, created_by_id) VALUES (?, ?)',
      [groupName, creatorId]
    );
    const newGroupId = groupResult.insertId; 

    if (!members.includes(String(creatorId))) {
      members.push(String(creatorId));
    }
    
    const memberRows = members.map(userId => [newGroupId, parseInt(userId)]);
    
    await connection.query(
      'INSERT INTO `group_members` (group_id, user_id) VALUES ?',
      [memberRows]
    );

    await connection.commit();
    res.status(200).json({ message: 'Grupo creado exitosamente', groupId: newGroupId });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error en la transacción de crear grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor al crear el grupo.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// NAVBAR
app.get('/', isAuthenticated, (req, res) => {
  res.render('dashboard', { activePage: 'home' }); 
});

app.get('/chat', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const [allUsers] = await pool.execute(
      'SELECT id, username FROM users WHERE id != ?',
      [currentUserId]
    );
    const [myGroups] = await pool.execute(
      `SELECT g.id, g.name 
       FROM \`groups\` g
       JOIN \`group_members\` gm ON g.id = gm.group_id
       WHERE gm.user_id = ?`,
      [currentUserId]
    );
    res.render('chat', { 
      activePage: 'chat',
      allUsers: allUsers,
      userGroups: myGroups
    });
  } catch (error) {
    console.error("Error al cargar datos para el chat:", error);
    res.redirect('/'); 
  }
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

