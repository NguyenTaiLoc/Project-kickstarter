const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const job = require('./main');
const db_action = require('./db_action');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = 3005;

// CORS setting
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// WebSocket connection handling
io.on('connection', async (socket) => {
  console.log('Client connected');

  try {
    // Send initial data when a client connects
    const moneyBackerTitleInfo = await job.getMoneyBackerTitleInfo();
    console.log('Sending initial data to client:', moneyBackerTitleInfo);
    socket.emit('moneyBackerTitleInfo', moneyBackerTitleInfo);
  } catch (error) {
    console.error('Error sending initial data to client:', error);
  }

  // Handle messages from client if needed
  socket.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  // Close connection handling
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

app.get('/', async (req, res) => {
  try {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Broadcast the data to all connected clients
    io.emit('moneyBackerTitleInfo', moneyBackerTitleInfo);

    res.json(moneyBackerTitleInfo);
  } catch (error) {
    console.error('Error getting combined information:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Close database connection and stop job when the server is closed
const closeServer = () => {
  db_action.closeDBConnect((err) => {
    if (err) {
      console.error('Error closing MySQL connection:', err);
    } else {
      console.log('MySQL connection closed');
      if (server) {
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    }
  });
};

// Handle Ctrl+C signal
process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing server and stopping job...');
  closeServer();
});

// Start the server
server.listen(PORT, () => {
  db_action.syncModels();
  console.log(`Server running at http://localhost:${PORT}`);
});
