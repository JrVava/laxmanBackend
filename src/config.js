require("dotenv").config();

const port = process.env.PORT || 8081;

const database = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  port: process.env.MYSQL_PORT,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

const jwtToken = {
  tokenSecret: process.env.ACCESS_TOKEN_SECRET,
  tokenExpiry: process.env.ACCESS_TOKEN_EXPIRY,
  refTokenSecret: process.env.REF_TOKEN_SECRET,
  refTokenExpiry: process.env.REF_TOKEN_EXPIRY,
};

module.exports = { port, database, jwtToken };