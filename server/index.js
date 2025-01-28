// server/index.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * rooms object structure:
 * {
 *   "roomName": {
 *      passkey: "someSecret" or null,
 *      users: { [socketId]: username },
 *      messages: [
 *        {
 *           user: "username",
 *           text: "message content",
 *           time: "HH:MM:SS",
 *           timestamp: 1680044109623  <-- used for 24-hr cleanup
 *        },
 *        ...
 *      ]
 *   }
 * }
 */
const rooms = {};

// Helper: create a room if it doesn’t exist
function ensureRoom(roomName, passkey = null) {
  if (!rooms[roomName]) {
    rooms[roomName] = {
      passkey, 
      users: {},
      messages: []
    };
  }
}

// Ephemeral cleanup: remove messages older than 24 hours
function cleanUpMessages() {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  Object.keys(rooms).forEach((roomName) => {
    const room = rooms[roomName];
    const filtered = room.messages.filter(msg => (now - msg.timestamp) < TWENTY_FOUR_HOURS);
    room.messages = filtered;
  });
}

// Run cleanup every minute (60000 ms).
setInterval(cleanUpMessages, 60_000);

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', (data) => {
    // data should have: roomName, passkey, username
    const { roomName, passkey, username } = data;

    // Make sure the room exists (or create it if passkey is provided)
    if (!rooms[roomName]) {
      // If user provided passkey, we create a new room with it
      // If not, we'll assume passkey can be null (open room).
      ensureRoom(roomName, passkey || null);
    }

    // Validate passkey if the room has one
    if (rooms[roomName].passkey && rooms[roomName].passkey !== passkey) {
      // passkey mismatch => reject join
      socket.emit('joinError', { message: 'Incorrect passkey for this room.' });
      return;
    }

    // Join the socket.io room
    socket.join(roomName);

    // Save user in memory
    rooms[roomName].users[socket.id] = username;

    // Let the client know it joined successfully
    socket.emit('joinedRoom', {
      roomName,
      messages: rooms[roomName].messages
    });

    // Broadcast updated user list to the room
    io.to(roomName).emit('usersList', Object.values(rooms[roomName].users));
  });

  socket.on('chatMessage', (data) => {
    // data: { roomName, user, text }
    const { roomName, user, text } = data;
    const room = rooms[roomName];
    if (!room) return; // room doesn't exist

    const messageObj = {
      user,
      text,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };

    // Push to in-memory array
    room.messages.push(messageObj);

    // Broadcast to everyone in that room
    io.to(roomName).emit('chatMessage', messageObj);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Remove user from whichever room(s) they are in
    Object.keys(rooms).forEach(roomName => {
      const room = rooms[roomName];
      if (room.users[socket.id]) {
        delete room.users[socket.id];
        // update user list in that room
        io.to(roomName).emit('usersList', Object.values(room.users));
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
