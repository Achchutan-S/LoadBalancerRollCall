const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const httpProxy = require("http-proxy");
const cors = require("cors");
const Register = require("./models/registers");

require("dotenv").config();

const app = express();
const apiProxy = httpProxy.createProxyServer();

const PORT = 3000;
const DB_URI = process.env.DB_URI;
const RESOURCE_SERVER_COUNT = 3;
const START_PORT = 3001;

let roundRobinIndex = 0;
const resourceServers = [];
const ports = Array.from(
  { length: RESOURCE_SERVER_COUNT },
  (_, i) => START_PORT + i
);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

const connectToDatabase = async () => {
  try {
    await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};

const createResourceServer = (port) => {
  const serverApp = express();

  serverApp.set("view engine", "ejs");
  serverApp.use(morgan("dev"));
  serverApp.use(express.json());
  serverApp.use(express.urlencoded({ extended: true }));
  serverApp.use(cors());

  serverApp.get("/", (req, res) => {
    console.log("Request from port", req.socket.localPort);
    res.render("index", { success: true, number: req.socket.localPort });
  });

  serverApp.get("/registers", async (req, res) => {
    console.log("Request from port", req.socket.localPort);
    const result = await Register.findOne({ regno: req.query.rno });
    if (result) {
      res.render("index", {
        number: req.socket.localPort,
        regno: result.rno,
        gender: result.gender,
        hostels: result.hostels,
      });
    }
  });

  serverApp.post("/", async (req, res) => {
    console.log("Request from port", req.socket.localPort);
    try {
      const existingStudent = await Register.findOne({ rno: req.body.rno });
      if (existingStudent) {
        console.log("Student already registered");
        return res.status(400).render("index", {
          number: req.socket.localPort,
          alertMessage:
            "Already registered. Please use a different registration number.",
        });
      }

      const registerStudent = new Register(req.body);
      await registerStudent.save();
      console.log("Rollcall registered successfully");
      res.status(201).render("index", { number: req.socket.localPort });
    } catch (err) {
      console.error("Error occurred:", err);
      res.status(500).render("index", {
        number: req.socket.localPort,
        errorMessage: "Internal Server Error",
      });
    }
  });

  serverApp.listen(port, () => {
    console.log(`Resource server listening on port ${port}`);
  });

  resourceServers.push(serverApp);
};

const initializeResourceServers = () => {
  ports.forEach(createResourceServer);
};

app.get("/", (req, res) => {
  const targetPort = ports[roundRobinIndex % RESOURCE_SERVER_COUNT];
  roundRobinIndex++;
  console.log(`Redirecting to Server: ${targetPort}`);
  apiProxy.web(
    req,
    res,
    { target: `http://localhost:${targetPort}` },
    (err) => {
      console.error("Proxy error:", err);
      res.status(500).send("Proxy error");
    }
  );
});

app.post("/", async (req, res) => {
  const targetPort = ports[roundRobinIndex % RESOURCE_SERVER_COUNT];
  roundRobinIndex++;
  console.log(`Redirecting to Server: ${targetPort}`);
  apiProxy.web(
    req,
    res,
    { target: `http://localhost:${targetPort}` },
    (err) => {
      console.error("Proxy error:", err);
      res.status(500).send("Proxy error");
    }
  );
});

connectToDatabase().then(() => {
  initializeResourceServers();
  app.listen(PORT, () => {
    console.log(`Load balancer listening on port ${PORT}`);
  });
});
