//BACK-END CODE SECTION
const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const axios = require("axios");

const mongoose = require("mongoose");
const Register = require("./models/registers");
const httpProxy = require("http-proxy");
//const dburi ="mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.6.0";

require("dotenv").config();

const dburi = process.env.DB_URI;
const app = express(); //initialize load balancer
var apiProxy = httpProxy.createProxyServer(); //creating proxy utility

var n = 3; //default number of resource servers
var start_port = 3001; //default starting port number
var i = 1; //initialization of round robin variable
var apps = []; //server farm
var ports = []; //ports listened by servers in the farm

//Load balancer:--> 'app' is the load balancer server
app.set("view engine", "ejs"); //setting view engine
app.use(express.static("public")); //setting static assets
app.use(express.urlencoded({ extended: true })); //for post requests
app.use(bodyParser.json());

app.get("/", function (req, res) {
  j = i % n; //round robin redirection using round robin variable
  if (j == 0) {
    console.log("redirecting to Server:" + n);
    apiProxy.web(req, res, { target: "http://localhost:" + ports[n - 1] });
    i++;
  } else {
    console.log("redirecting to Server:" + j);
    apiProxy.web(req, res, { target: "http://localhost:" + ports[j - 1] });
    i++;
  }
});

app.post("/", async (req, res) => {
  // console.log("Reached post");
  console.log("request from port" + req.socket.localPort);
  try {
    // Check if the rno is already registered
    const existingStudent = await Register.findOne({ rno: req.body.rno });

    if (existingStudent) {
      // If already registered, render "index" page with an alert message
      console.log("Student already registered");
      const alertMessage =
        "Already registered. Please use a different registration number.";
      return res.status(400).render("index", { alertMessage: alertMessage });
    }

    const registerStudent = new Register({
      rno: req.body.rno,
      gender: req.body.gender,
      hostels: req.body.hostels,
    });
    console.log(req.body.rno);
    
    const registered = await registerStudent.save();
    console.log("Rollcall registered successfully");
    
    res.status(201).render("index");
  } catch (err) {
    if (err.code === 11000) {
      // Handle duplicate key error (already registered) with an alert
      console.log("Student already registered");
      const alertMessage =
        "Already registered. Please use a different registration number.";
      const alertScript = `<script>alert("${alertMessage}");</script>`;
      return res.status(400).send(alertScript);
    } else {
      // Handle other errors
      console.log("Error occurred:", err);
      const errorMessage = "Internal Server Error";

      return res.status(500).render("index", { errorMessage });
    }
  }
});
//The load balancer app listens on this port.
app.listen(3000); // listen on port 3000

//Code to handle of Resource servers
for (let j = 0; j < n; j++) {
  var x = parseInt(start_port) + parseInt(j);
  apps.push(express());
  ports.push(x);
}
console.log(ports);

for (let j = 0; j < n; j++) {
  //RESOURCE SERVERS STORED IN SERVER FARM 'apps'
  apps[j].set("view engine", "ejs"); //setting view engine
  apps[j].use(morgan("dev")); //setting middleware
  apps[j].use(express.json());
  apps[j].use(express.urlencoded({ extended: true })); //encoding url to handle post requests

  // . modif 1
  mongoose
    .connect(dburi, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then((result) => {
      apps[j].listen(ports[j]);
      console.log(ports[j]);
    })
    .catch((err) => console.log(err)); //connecting to DATABASE

  // . new 5 Database Connection Verification
  mongoose.connection
    .once("open", () => console.log("Mongodb connected"))
    .on("error", (error) => {
      console.log("Mongodb connection error: " + error);
    });

  //rendering index
  apps[j].get("/", function (req, res) {
    if (req.query.success == "false") {
      success = false;
    } else {
      success = true;
    }
    console.log("request from port" + req.socket.localPort);
    // res.render('index', { success: success, number: req.socket.localPort });
    res.render("index", { success: true, number: req.socket.localPort });
  });
  // . new2
  apps[j].get("/registers", function (req, res) {
    console.log("request from port" + req.socket.localPort);
    Register.find({ regno: req.query.rno }).then((result) => {
      regno = result[0].rno;
      gender = result[0].gender;
      hostel = result[0].hostels;

      res.render("index", {
        number: req.socket.localPort,
        regno: req.query.rno,
        gender: gender,
        hostels: hostel,
      });
      console.log("request from port" + PORT);
    });
  });

  apps[j].post("/", async (req, res) => {
    // console.log("Reached post");
    console.log("request from port" + req.socket.localPort);
    try {
      // Check if the rno is already registered
      const existingStudent = await Register.findOne({ rno: req.body.rno });

      if (existingStudent) {
        // If already registered, render "index" page with an alert message
        console.log("Student already registered");
        const alertMessage =
          "Already registered. Please use a different registration number.";
        return res.status(400).render("index", { alertMessage: alertMessage });
      }
      // If not already registered, save the new registration

      const registerStudent = new Register({
        rno: req.body.rno,
        gender: req.body.gender,
        hostels: req.body.hostels,
      });
      console.log(req.body.rno);
      const registered = await registerStudent.save();
      console.log("Rollcall registered successfully");
      // res.send(registerStudent.rno);
      res.status(201).render("index");
    } catch (err) {
      if (err.code === 11000) {
        // Handle duplicate key error (already registered) with an alert
        console.log("Student already registered");
        const alertMessage =
          "Already registered. Please use a different registration number.";
        const alertScript = `<script>alert("${alertMessage}");</script>`;
        return res.status(400).send(alertScript);
      } else {
        // Handle other errors
        console.log("Error occurred:", err);
        const errorMessage = "Internal Server Error";

        return res.status(500).render("index", { errorMessage });
      }
    }
  });
}
