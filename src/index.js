var config = require("./config");
var express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

var routes = require("./routes/route");

app.use("/", routes);


var server = app.listen(config.port, function () {
  var port = server.address().port;
  console.log(`API is running on http://localhost:${port}`);
});