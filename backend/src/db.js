// db.js
const mysql = require("mysql");
var config = require("../src/config");

const db = mysql.createConnection(config.database);
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

const query = (sql, params) => {
  return new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
          if (err) {
              return reject(err);
          }
          resolve(results);
      });
  });
};

module.exports = {db,query};