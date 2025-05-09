const mysql = require('mysql2');
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'work_orders_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
console.log('Pool de conexiones MySQL creado');
module.exports = db;