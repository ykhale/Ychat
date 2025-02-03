// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

const app = express();

// CORS Configuration - allow only your Netlify frontend
const allowedOrigins = ["https://ychats.netlify.app","https://ychat.live"];
app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }));

// Create HTTP server and attach Socket.IO with increased payload limit
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 50 * 1024 * 1024 // Allow payloads up to 50 MB
});

// Ensure MONGO_URI is set
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set in environment variables! Check Render settings.");
  process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Define a Message schema with TTL (24 hours), relative timestamps and read receipts
const messageSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  user: { type: String, required: true },
  avatar: { type: String }, // optionally store sender's avatar with the message
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: '24h' } },
  readBy: { type: [String], default: [] }
});
const Message = mongoose.model('Message', messageSchema);

// Maintain a map of room -> list of users (as objects: { username, avatar })
const roomUsers = {};
// In-memory read receipts (keyed by message ID)
const readReceipts = {};

io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // When a user joins a room (avatar now included)
  socket.on('joinRoom', async ({ roomName, username, avatar }) => {
    socket.join(roomName);
    socket.roomName = roomName;
    socket.username = username;
    socket.avatar = avatar;
    if (!roomUsers[roomName]) {
      roomUsers[roomName] = [];
    }
    // Only add if not already present
    if (!roomUsers[roomName].find(u => u.username === username)) {
      roomUsers[roomName].push({ username, avatar });
    }
    console.log(`🔹 User "${username}" joined room: "${roomName}"`);

    try {
      // Fetch last 24 hours of messages (including createdAt)
      const recentMessages = await Message.find({ roomName }).sort({ createdAt: 1 });
      const messages = recentMessages.map(msg => {
        const m = msg.toObject();
        m._id = m._id.toString();
        if (!m.readBy) m.readBy = [];
        return m;
      });
      socket.emit('joinedRoom', { roomName, messages });
      // Broadcast updated user list to everyone in the room
      io.to(roomName).emit('usersList', roomUsers[roomName]);
    } catch (error) {
      console.error("❌ Error fetching messages from MongoDB:", error);
      socket.emit('joinError', { message: "Error retrieving chat history." });
    }
  });

  // Handle new chat messages (avatar is also sent along)
  socket.on('chatMessage', async ({ roomName, user, text, avatar }) => {
    try {
      // The sender automatically "reads" their own message
      const newMessage = new Message({ roomName, user, text, avatar, readBy: [user] });
      const savedMessage = await newMessage.save();
      let messageObj = savedMessage.toObject();
      messageObj._id = messageObj._id.toString();
      if (!messageObj.readBy) messageObj.readBy = [];
      readReceipts[messageObj._id] = messageObj.readBy;
      io.to(roomName).emit('chatMessage', messageObj);
    } catch (error) {
      console.error("❌ Error saving message:", error);
      socket.emit('error', { message: "Failed to send message." });
    }
  });

  // Handle read receipt updates from clients
  socket.on('messageRead', ({ messageId, roomName, username }) => {
    if (!readReceipts[messageId]) {
      readReceipts[messageId] = [];
    }
    if (!readReceipts[messageId].includes(username)) {
      readReceipts[messageId].push(username);
    }
    io.to(roomName).emit('readReceipt', { messageId, readBy: readReceipts[messageId] });
  });

  // Typing indicator events
  socket.on('typing', ({ roomName, username }) => {
    socket.to(roomName).emit('userTyping', { username });
  });
  socket.on('stopTyping', ({ roomName, username }) => {
    socket.to(roomName).emit('userStopTyping', { username });
  });

  // Handle disconnection: remove user from room list and broadcast update
  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
    const userRoom = socket.roomName;
    const userName = socket.username;
    if (userRoom && userName && roomUsers[userRoom]) {
      roomUsers[userRoom] = roomUsers[userRoom].filter(u => u.username !== userName);
      io.to(userRoom).emit('usersList', roomUsers[userRoom]);
    }
  });
});

// Use Render’s assigned port dynamically
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});