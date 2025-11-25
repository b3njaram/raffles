const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());


// Use an absolute path for the DB file (project root db.json)
const DB_FILE = path.join(__dirname, '..', 'db.json');

// Function to read data from the database file
const readData = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If the file doesn't exist, create it with an initial structure
    if (err && err.code === 'ENOENT') {
      const initial = { raffles: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    // For other errors or invalid JSON, log and return an empty structure
    console.error('Failed to read DB file:', err);
    return { raffles: [] };
  }
};

// Function to write data to the database file
const writeData = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Get all raffles
app.get('/api/raffles', (req, res) => {
  const data = readData();
  res.json(data.raffles);
});

// Create a new raffle
app.post('/api/raffles', (req, res) => {
  const data = readData();
  const newRaffle = {
    id: Date.now(),
    name: req.body.name,
    participants: [],
    winner: null
  };
  data.raffles.push(newRaffle);
  writeData(data);
  res.status(201).json(newRaffle);
});

// Add a participant to a raffle
app.post('/api/raffles/:id/participants', (req, res) => {
  const data = readData();
  const raffle = data.raffles.find(r => r.id === parseInt(req.params.id));
  if (raffle) {
    const newParticipant = {
      id: Date.now(),
      name: req.body.name
    };
    raffle.participants.push(newParticipant);
    writeData(data);
    res.status(201).json(newParticipant);
  } else {
    res.status(404).send('Raffle not found');
  }
});

// Draw a winner for a raffle
app.post('/api/raffles/:id/draw', (req, res) => {
  const data = readData();
  const raffle = data.raffles.find(r => r.id === parseInt(req.params.id));
  if (raffle && raffle.participants.length > 0) {
    const winnerIndex = Math.floor(Math.random() * raffle.participants.length);
    raffle.winner = raffle.participants[winnerIndex];
    writeData(data);
    io.emit('winnerDrawn', raffle); // Notify all clients
    res.json(raffle.winner);
  } else {
    res.status(400).send('Raffle not found or no participants');
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});