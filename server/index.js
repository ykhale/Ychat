// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

const app = express();
app.use(cors());

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ychat";
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB Atlas"))
.catch(err => console.error("MongoDB connection error:", err));

// Define a Message schema with a TTL of 24 hours
const messageSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  user: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: String, default: () => new Date().toLocaleTimeString() },
  createdAt: { type: Date, default: Date.now, index: { expires: '24h' } }
});

const Message = mongoose.model('Message', messageSchema);

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins a room
  socket.on('joinRoom', async ({ roomName, username }) => {
    socket.join(roomName);

    // Fetch last 24 hours of messages from MongoDB
    const recentMessages = await Message.find({ roomName }).sort({ createdAt: 1 });
    socket.emit('roomHistory', recentMessages); // Send history to the client
  });

  // Handle new chat message
  socket.on('chatMessage', async ({ roomName, user, text }) => {
    const newMessage = new Message({ roomName, user, text });
    await newMessage.save(); // Save to database

    // Broadcast to everyone in the room
    io.to(roomName).emit('chatMessage', {
      user,
      text,
      time: newMessage.time
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 10000;  // Ensure we use Render's assigned port
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

