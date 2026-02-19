const mysql = require('mysql2/promise');


let connection;

async function getConnection() {
  if (!connection) {
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "",
      database: "HY359_2025",
    });
    console.log('MySQL connection established.');
  }
  return connection;
}


// function to retrieve all users
async function getAllUsers() {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM users');
    return rows;
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}

async function getUserByCredentials(username, password) {
  try {
    const conn = await getConnection();

    const selectQuery = `
      SELECT * FROM users
      WHERE username = ? AND password = ?
    `;

    const [rows] = await conn.execute(selectQuery, [username, password]);

    return rows; 
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}


async function updateUser(username, newFirstname) {
  try {
    const conn = await getConnection();

    const updateQuery = `
      UPDATE users
      SET firstname = ?
      WHERE username = ?
    `;

    const [result] = await conn.execute(updateQuery, [newFirstname, username]);

    if (result.affectedRows === 0) {
      return 'No user found with that username.';
    }

    return 'Firstname updated successfully.';
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}

async function deleteUser(username) {
  try {
    const conn = await getConnection();

    const deleteQuery = `
      DELETE FROM users
      WHERE username = ?
    `;

    const [result] = await conn.execute(deleteQuery, [username]);

    if (result.affectedRows === 0) {
      return 'No user found with that username.';
    }

    return 'User deleted successfully.';
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}


module.exports = {getAllUsers, getUserByCredentials, updateUser, deleteUser};