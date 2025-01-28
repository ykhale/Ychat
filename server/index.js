// server/index.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

const app = express();

// ✅ CORS Configuration - allow only your Netlify frontend
// Make sure this matches your actual Netlify domain
const allowedOrigins = ["https://ychats.netlify.app"];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true
}));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ✅ Ensure MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set in environment variables! Check Render settings.");
  process.exit(1); // Stop execution if MongoDB URL is missing
}

// ✅ Connect to MongoDB Atlas
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Stop execution if database connection fails
  });

// ✅ Define a Message schema with TTL (24 hours)
const messageSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  user: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: String, default: () => new Date().toLocaleTimeString() },
  createdAt: { type: Date, default: Date.now, index: { expires: '24h' } } // Auto-delete after 24 hours
});

const Message = mongoose.model('Message', messageSchema);

// ✅ Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // When a user joins a room
  socket.on('joinRoom', async ({ roomName, username }) => {
    // Join the Socket.IO room
    socket.join(roomName);
    console.log(`🔹 User ${username} joined room: ${roomName}`);

    try {
      // Fetch last 24 hours of messages
      const recentMessages = await Message.find({ roomName }).sort({ createdAt: 1 });

      // Emit "joinedRoom" so the client receives { roomName, messages }
      socket.emit('joinedRoom', {
        roomName,
        messages: recentMessages
      });
    } catch (error) {
      console.error("❌ Error fetching messages from MongoDB:", error);
      // Emit a generic error event if something goes wrong
      socket.emit('joinError', { message: "Error retrieving chat history." });
    }
  });

  // Handle new chat message
  socket.on('chatMessage', async ({ roomName, user, text }) => {
    try {
      // Create and save a new message
      const newMessage = new Message({ roomName, user, text });
      await newMessage.save();

      // Broadcast the message to everyone in the room
      io.to(roomName).emit('chatMessage', {
        user,
        text,
        time: newMessage.time
      });
    } catch (error) {
      console.error("❌ Error saving message:", error);
      socket.emit('error', { message: "Failed to send message." });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// ✅ Use Render’s assigned port dynamically
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
