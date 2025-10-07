const mysql = require ('mysql2/promise');

const pool = mysql.createPool({
    host:'localhost',
    user:'root',
    password:'CrimsonNight16',
    database:'kick_db'
});

module.exports=pool;