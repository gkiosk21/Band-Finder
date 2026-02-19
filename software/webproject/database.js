const mysql = require('mysql2/promise');


let connection;

async function getConnection() {
  if (!connection) {
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: ""
    });
    console.log('MySQL connection established.');
  }
  return connection;
}


async function initDatabase() {
  try {
    const conn = await getConnection();


    await conn.query(`CREATE DATABASE IF NOT EXISTS HY359_2025`);
    await conn.query(`USE HY359_2025`);

    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(30) NOT NULL UNIQUE,
        email VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(32) NOT NULL,
        firstname VARCHAR(30) NOT NULL,
        lastname VARCHAR(30) NOT NULL,
        birthdate DATE NOT NULL,
        gender VARCHAR(10) NOT NULL,
        country VARCHAR(30) NOT NULL,
        city VARCHAR(30),
        address VARCHAR(100) NOT NULL,
        telephone VARCHAR(20) NOT NULL,
        lat DOUBLE,
        lon DOUBLE
     )
    `;

    const createBandsTableQuery = `
        CREATE TABLE bands (
  band_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(32) NOT NULL,
  band_name VARCHAR(100) NOT NULL UNIQUE,
  music_genres VARCHAR(100) NOT NULL,
  band_description VARCHAR(500) NOT NULL,
  members_number INT NOT NULL,
  foundedYear INT NOT NULL,
  band_city VARCHAR(100) NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  webpage VARCHAR(255) ,
  photo VARCHAR(255) 
    )`;

    const createReviewsTableQuery = `
  CREATE TABLE reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  band_name VARCHAR(100) NOT NULL,
  sender VARCHAR(100) NOT NULL,
  review VARCHAR(800) NOT NULL,
  rating INT NOT NULL,
  date_time DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  FOREIGN KEY (band_name) REFERENCES bands(band_name)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)
  `;

    const createMessagesTableQuery = `
CREATE TABLE messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  private_event_id INT NOT NULL,
  message TEXT NOT NULL,
  sender VARCHAR(50) NOT NULL,
  recipient VARCHAR(50) NOT NULL,
  date_time DATETIME NOT NULL,
  FOREIGN KEY (private_event_id) REFERENCES private_events(private_event_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)`;

const createPublicEventsTableQuery=`
CREATE TABLE public_events (
  public_event_id INT AUTO_INCREMENT PRIMARY KEY,
  band_id INT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_datetime DATETIME NOT NULL,
  event_description VARCHAR(800) NOT NULL,
  participants_price DECIMAL(10,2) NOT NULL,
  event_city VARCHAR(100) NOT NULL,
  event_address VARCHAR(255) NOT NULL,
  event_lat DOUBLE,
  event_lon DOUBLE,
  FOREIGN KEY (band_id) REFERENCES bands(band_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)`;

const createPrivateEventsTableQuery=`
CREATE TABLE private_events (
  private_event_id INT AUTO_INCREMENT PRIMARY KEY,
  band_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  band_decision VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_datetime DATETIME NOT NULL,
  event_description VARCHAR(800) NOT NULL,
  event_city VARCHAR(100) NOT NULL,
  event_address VARCHAR(255) NOT NULL,
  event_lat DOUBLE,
  event_lon DOUBLE,
  FOREIGN KEY (band_id) REFERENCES bands(band_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)
`;


    const createProfileVisitsTableQuery = `
CREATE TABLE IF NOT EXISTS profile_visits (
  visit_id INT AUTO_INCREMENT PRIMARY KEY,
  band_id INT NOT NULL,
  user_id INT,
  visit_time DATETIME NOT NULL,
  FOREIGN KEY (band_id) REFERENCES bands(band_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
)`;

    await conn.query(createUsersTableQuery);
    await conn.query(createBandsTableQuery);
    await conn.query(createPrivateEventsTableQuery);
    await conn.query(createPublicEventsTableQuery);
    await conn.query(createReviewsTableQuery);
    await conn.query(createMessagesTableQuery);
    await conn.query(createProfileVisitsTableQuery);

    return `Database HY359_2025 initialized successfully (if it does not exist).`;
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}

async function dropDatabase() {
  try {
    const conn = await getConnection();
    await conn.query(`DROP DATABASE IF EXISTS HY359_2025`);
    return `Database HY359_2025 dropped successfully.`;
  } catch (err) {
    throw new Error('DB error: ' + err.message);
  }
}

module.exports = { initDatabase, dropDatabase };

