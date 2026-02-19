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


async function insertUser(user) {
      try {
        const conn = await getConnection();
    

        const insertQuery = `
          INSERT INTO users (
            username, email, password, firstname, lastname,
            birthdate, gender, country, city, address, telephone, lat, lon
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    
        await conn.execute(insertQuery, [
          user.username,
          user.email,
          user.password,
          user.firstname,
          user.lastname,
          user.birthdate,
          user.gender,
          user.country,
          user.city,
          user.address,
          user.telephone,
          user.lat,
          user.lon
        ]);
    
        return 'User inserted successfully (single connection reused).';
      } catch (err) {
    console.log(err.message)
   
        throw new Error('DB error: ' + err.message);
      }
    
}

async function insertBand(band) {
  try {
    const conn = await getConnection();

    const insertQuery = `
      INSERT INTO bands (
        band_id, username, email, password, band_name, music_genres,
        band_description, members_number, foundedYear, band_city,
        telephone, webpage, photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.execute(insertQuery, [
      band.band_id,
      band.username,
      band.email,
      band.password,
      band.band_name,
      band.music_genres,
      band.band_description,
      band.members_number,
      band.foundedYear,
      band.band_city,
      band.telephone,
      band.webpage,
      band.photo
    ]);

    return 'Band inserted successfully.';
  } catch (err) {
    console.log(err.message)
   
    throw new Error('DB error: ' + err.message);
  }
}

async function insertReview(review) {
  try {
    const conn = await getConnection();

    const insertQuery = `
      INSERT INTO reviews (
        band_name, sender, review, rating, date_time, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await conn.execute(insertQuery, [
      review.band_name,
      review.sender,
      review.review,
      review.rating,
      review.date_time,  
      review.status
    ]);

    return 'Review inserted successfully.';
  } catch (err) {
    console.log(err.message)
    throw new Error('DB error: ' + err.message);
  }
}

async function insertMessage(message) {
  try {
    const conn = await getConnection();

    const insertQuery = `
      INSERT INTO messages (
        private_event_id, message, sender, recipient, date_time
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await conn.execute(insertQuery, [
      message.private_event_id,
      message.message,
      message.sender,
      message.recipient,
      message.date_time 
    ]);

    return 'Message inserted successfully.';
  } catch (err) {
     console.log(err.message)
   
    throw new Error('DB error: ' + err.message);
  }
}

async function insertPublicEvent(event) {
  try {
    const conn = await getConnection();

    const insertQuery = `
      INSERT INTO public_events (
        band_id,
        event_type,
        event_datetime,
        event_description,
        participants_price,
        event_city,
        event_address,
        event_lat,
        event_lon
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.execute(insertQuery, [
      event.band_id,
      event.event_type,
      event.event_datetime,  
      event.event_description,
      event.participants_price,
      event.event_city,
      event.event_address,
      event.event_lat,
      event.event_lon
    ]);
    return 'Public event inserted successfully.';
  } catch (err) {
    console.log(err.message)
    throw new Error('DB error: ' + err.message);
  }
}


async function insertPrivateEvent(event) {
  try {
    const conn = await getConnection();

    const insertQuery = `
      INSERT INTO private_events (
        band_id,
        price,
        status,
        band_decision,
        user_id,
        event_type,
        event_datetime,
        event_description,
        event_city,
        event_address,
        event_lat,
        event_lon
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.execute(insertQuery, [
      event.band_id,
      event.price,
      event.status,
      event.band_decision,
      event.user_id,
      event.event_type,
       event.event_datetime, 
      event.event_description,
      event.event_city,
      event.event_address,
      event.event_lat,
      event.event_lon
    ]);

    return 'Private event inserted successfully.';
  } catch (err) {
     console.log(err.message)
    throw new Error('DB error: ' + err.message);
  }
}




module.exports = { insertUser, insertBand, insertReview, insertMessage, insertPublicEvent, insertPrivateEvent };