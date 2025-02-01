// client/src/App.js

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Initialize Socket.IO client to connect to your server
const socket = io("https://ychat-lovu.onrender.com/");

// Notification sound for new messages (place "notification.mp3" in your public folder)
const notificationSound = new Audio("notification.mp3");

// Helper function to generate relative time (e.g., "5 minutes ago")
function timeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

// Animated tagline component that cycles through phrases every 2 seconds
const AnimatedTagline = () => {
  const phrases = ["with anyone", "anywhere", "privately", "for free", "always"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return <span>{phrases[index]}</span>;
};

// Component for an animated typing indicator (shows an ellipsis animation)
const CombinedTypingIndicator = ({ users, style }) => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length < 3 ? prev + '.' : ''));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  const userText = users.join(', ');
  return <div style={style}>{userText} {users.length === 1 ? 'is' : 'are'} typing{dots}</div>;
};

function App() {
  // ------------------------
  // State declarations
  // ------------------------

  // Connection and join page states
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [avatar, setAvatar] = useState(null); // Profile picture as Base64 string
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Chat-related states
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Dark mode state: false for light mode, true for dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Refs for auto-scrolling and scrolling to the join section
  const messagesPanelRef = useRef(null);
  const joinSectionRef = useRef(null);

  // Ref for debouncing typing indicator events
  const typingTimeoutRef = useRef(null);

  // ------------------------
  // Socket.IO Event Listeners
  // ------------------------
  useEffect(() => {
    // When the server confirms joining the room
    socket.on('joinedRoom', (data) => {
      setIsJoined(true);
      setJoinError("");
      setMessages(data.messages);
    });

    // When there is an error joining the room
    socket.on('joinError', (error) => {
      setJoinError(error.message);
    });

    // When a new chat message is received
    socket.on('chatMessage', (msgObj) => {
      setMessages(prev => [...prev, msgObj]);
      // Play notification sound if the message is from another user
      if (msgObj.user !== username) {
        notificationSound.play().catch(err => console.log("Sound error:", err));
      }
    });

    // Update the user list in the room
    socket.on('usersList', (allUsers) => {
      setUsersList(allUsers);
    });

    // Update read receipts when notified by the server
    socket.on('readReceipt', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, readBy };
        }
        return msg;
      }));
    });

    // Update typing indicator when a user is typing
    socket.on('userTyping', ({ username: typingUser }) => {
      setTypingUsers(prev => {
        if (!prev.includes(typingUser)) {
          return [...prev, typingUser];
        }
        return prev;
      });
    });
    // Remove user from typing list when they stop typing
    socket.on('userStopTyping', ({ username: stopUser }) => {
      setTypingUsers(prev => prev.filter(u => u !== stopUser));
    });

    // Clean up all event listeners on unmount
    return () => {
      socket.off('joinedRoom');
      socket.off('joinError');
      socket.off('chatMessage');
      socket.off('usersList');
      socket.off('readReceipt');
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [username]);

  // ------------------------
  // Auto-scroll and read receipt logic
  // ------------------------
  useEffect(() => {
    // Auto-scroll to the bottom of the messages panel whenever messages update
    if (messagesPanelRef.current) {
      messagesPanelRef.current.scrollTop = messagesPanelRef.current.scrollHeight;
    }
    // For every message not yet marked as read by current user, send a read receipt
    messages.forEach(msg => {
      if (!msg.readBy || !msg.readBy.includes(username)) {
        socket.emit('messageRead', { messageId: msg._id, roomName, username });
      }
    });
  }, [messages, roomName, username]);

  // ------------------------
  // Event Handlers
  // ------------------------

  // Toggle dark mode using a button with sun/moon icons
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Handle typing events with a debounce timer
  const handleTyping = () => {
    socket.emit('typing', { roomName, username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { roomName, username });
    }, 2000);
  };

  // Handle profile picture upload for join page
  // This function validates the file is an image and is below 10 MB
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check that the file type is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }
      // Limit file size to 10 MB
      const maxSize = 10 * 1024 * 1024; // 10 MB in bytes
      if (file.size > maxSize) {
        alert('Image is too large. Please select an image under 10MB.');
        return;
      }
      // Use FileReader to convert the image file to a Base64 string
      const reader = new FileReader();
      reader.onerror = () => {
        alert('Error reading file. Please try a different image.');
      };
      reader.onload = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle joining a room by sending username, room name, and avatar to the server
  const handleJoinRoom = () => {
    if (!username.trim() || !roomName.trim()) {
      alert("Username and Room Name are required!");
      return;
    }
    socket.emit('joinRoom', { roomName, username, avatar });
  };

  // Send a text message to the room
  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    socket.emit('chatMessage', { roomName, user: username, text: currentMessage, avatar });
    setCurrentMessage("");
    socket.emit('stopTyping', { roomName, username });
  };

  // Scroll to the join form when "Get Started Now" is clicked
  const scrollToJoin = () => {
    if (joinSectionRef.current) {
      joinSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ------------------------
  // Dynamic Styles (theme changes based on dark mode)
  // ------------------------
  const themeStyles = {
    // Container uses a gradient background that adapts based on dark mode
    container: {
      fontFamily: 'Poppins, sans-serif',
      padding: 20,
      width: '100%',
      minHeight: '100vh',
      background: darkMode 
        ? "linear-gradient(135deg, #0f2027, #203a43, #2c5364)"  // Dark gradient
        : "linear-gradient(135deg, #a8edea, #fed6e3)",            // Light gradient
      color: darkMode ? '#e0e0e0' : '#333',
      position: 'relative'
    },
    // Hero section at the top of the join page with animated tagline
    hero: {
      textAlign: 'center',
      marginBottom: 20,
      padding: '40px 20px'
    },
    heroTitle: {
      fontSize: '2.8rem',
      fontWeight: 'bold',
      margin: 0
    },
    heroSubtitle: {
      fontSize: '1.3rem',
      color: darkMode ? '#aaa' : '#555'
    },
    // Join container holds the form elements on the join page
    joinContainer: {
      maxWidth: 400,
      margin: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      backgroundColor: darkMode ? '#1e1e1e' : '#FFFFFFEE',
      padding: 20,
      borderRadius: 8,
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      textAlign: 'center'
    },
    // Style for profile picture preview on the join page
    avatarPreview: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      objectFit: 'cover',
      margin: '10px auto',
      display: 'block'
    },
    // Input field styling
    input: {
      padding: 10,
      fontSize: '1rem',
      border: '2px solid #a8edea',
      borderRadius: 6,
      outline: 'none',
      marginTop: 4,
      backgroundColor: darkMode ? '#333' : '#fff',
      color: darkMode ? '#e0e0e0' : '#333'
    },
    // Label for file input styled as a button
    fileLabel: {
      cursor: 'pointer',
      padding: '10px',
      border: '2px solid #a8edea',
      borderRadius: 6,
      display: 'block',
      marginTop: 4,
      backgroundColor: darkMode ? '#333' : '#fff',
      color: darkMode ? '#e0e0e0' : '#333'
    },
    // Style for general buttons
    button: {
      padding: 12,
      cursor: 'pointer',
      border: 'none',
      borderRadius: 6,
      backgroundColor: '#FF758C',
      color: '#fff',
      fontWeight: 600,
      marginTop: 8
    },
    // Chat container layout (split between user panel and chat panel)
    chatContainer: {
      display: 'flex',
      flexDirection: 'row',
      height: '80vh',
      maxWidth: 1200,
      margin: 'auto',
      border: '1px solid #ccc',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      backgroundColor: darkMode ? '#1e1e1e' : '#fff'
    },
    // Left panel for the user list
    userPanel: {
      width: '20%',
      borderRight: '1px solid #ccc',
      padding: 10,
      overflowY: 'auto',
      backgroundColor: darkMode ? '#2a2a2a' : '#fefefe'
    },
    // Each user item in the user panel
    userItem: {
      padding: 8,
      marginBottom: 4,
      borderRadius: 4,
      backgroundColor: darkMode ? '#3a3a3a' : '#F9F9F9',
      borderBottom: '1px solid #eee',
      display: 'flex',
      alignItems: 'center'
    },
    // Style for user avatar in the user panel
    userAvatar: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      marginRight: 8,
      objectFit: 'cover'
    },
    // Right panel for the chat area
    chatPanel: {
      width: '80%',
      display: 'flex',
      flexDirection: 'column',
      padding: 10,
      backgroundColor: darkMode ? '#121212' : '#fff'
    },
    // Panel containing chat messages
    messagesPanel: {
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: 10,
      border: '1px solid #ddd',
      borderRadius: 6,
      backgroundColor: darkMode ? '#1e1e1e' : '#fafafa'
    },
    // Each individual message item style
    messageItem: {
      maxWidth: '70%',
      padding: 10,
      borderRadius: 6,
      wordWrap: 'break-word',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      fontSize: '0.95rem',
      position: 'relative',
      backgroundColor: darkMode ? '#2a2a2a' : '#F8F8F8'
    },
    // Header for each message (contains avatar, username, and timestamp)
    messageHeader: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 4
    },
    // Avatar in the message header
    messageAvatar: {
      width: 25,
      height: 25,
      borderRadius: '50%',
      marginRight: 8,
      objectFit: 'cover'
    },
    // Timestamp styling for each message
    messageTime: {
      fontSize: '0.8rem',
      color: darkMode ? '#ccc' : '#888',
      marginLeft: 'auto'
    },
    // Read receipt text styling
    readReceipt: {
      fontSize: '0.75rem',
      color: darkMode ? '#ccc' : '#888',
      marginTop: 4
    },
    // Row containing the text input and send button
    inputRow: {
      display: 'flex',
      marginTop: 10
    },
    // Footer description section at the bottom of the join page
    footer: {
      textAlign: 'center',
      marginTop: 40,
      padding: '20px 10px',
      backgroundColor: darkMode ? '#1e1e1e' : '#fff',
      borderTop: '1px solid #ccc'
    },
    footerTitle: {
      fontSize: '1.8rem',
      marginBottom: 10
    },
    footerText: {
      fontSize: '1rem',
      marginBottom: 20,
      color: darkMode ? '#aaa' : '#555'
    },
    // Style for the dark mode toggle button
    darkModeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      padding: '8px 12px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: 4,
      backgroundColor: '#FF758C',
      color: '#fff',
      fontSize: '1rem'
    }
  };

  // ------------------------
  // Render JSX
  // ------------------------
  return (
    <div style={themeStyles.container}>
      {/* Dark Mode Toggle Button with Sun/Moon icons */}
      <button style={themeStyles.darkModeButton} onClick={toggleDarkMode}>
        {darkMode ? '🌞 Light Mode' : '🌜 Dark Mode'}
      </button>

      {!isJoined ? (
        // Join (Landing) Page with Hero Section and Animated Tagline
        <div ref={joinSectionRef}>
          <div style={themeStyles.joinContainer}>
            <div style={themeStyles.hero}>
              {/* Changed "Talk" to "Chat" on the front page */}
              <h1 style={themeStyles.heroTitle}>Welcome to Chat</h1>
              <p style={themeStyles.heroSubtitle}>
                Chat <AnimatedTagline />
              </p>
            </div>
            {/* Profile picture preview */}
            {avatar && <img src={avatar} alt="Avatar Preview" style={themeStyles.avatarPreview} />}
            {/* Username input field */}
            <input
              style={themeStyles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {/* Room name input field */}
            <input
              style={themeStyles.input}
              type="text"
              placeholder="Room Name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            {/* Label for profile picture upload */}
            <label style={themeStyles.fileLabel}>
              Choose Profile Picture
              <input
                style={{ display: 'none' }}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </label>
            <button style={themeStyles.button} onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>
          {/* Footer description section with a call-to-action */}
          <div style={themeStyles.footer}>
            <h2 style={themeStyles.footerTitle}>Discover Chat</h2>
            <p style={themeStyles.footerText}>
              Enjoy instant messaging without the hassle of creating an account. We value your privacy – no personal information required!
              Connect instantly in a secure, fast, and intuitive environment. Experience messaging as it should be.
            </p>
            <button style={themeStyles.button} onClick={scrollToJoin}>
              Get Started Now
            </button>
          </div>
        </div>
      ) : (
        // Chat Room Page
        <div style={themeStyles.chatContainer}>
          {/* Left Panel: Users List */}
          <div style={themeStyles.userPanel}>
            <h3>Users ({usersList.length})</h3>
            {usersList.map((user, idx) => (
              <div key={idx} style={themeStyles.userItem}>
                {user.avatar && (
                  <img src={user.avatar} alt={user.username} style={themeStyles.userAvatar} />
                )}
                <span>{user.username}</span>
              </div>
            ))}
          </div>
          {/* Right Panel: Chat */}
          <div style={themeStyles.chatPanel}>
            <h2>Room: {roomName}</h2>
            <div style={themeStyles.messagesPanel} ref={messagesPanelRef}>
              {messages.map((msg, idx) => (
                <div key={msg._id || idx} style={themeStyles.messageItem}>
                  <div style={themeStyles.messageHeader}>
                    {msg.avatar && (
                      <img src={msg.avatar} alt={msg.user} style={themeStyles.messageAvatar} />
                    )}
                    <strong>{msg.user}</strong>
                    <div style={themeStyles.messageTime}>{timeAgo(msg.createdAt)}</div>
                  </div>
                  {/* Since image sending is removed, we render only text messages */}
                  <div>{msg.text}</div>
                  {msg.readBy && msg.readBy.length > 0 && (
                    <div style={themeStyles.readReceipt}>
                      Read by: {msg.readBy.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Enhanced Typing Indicator */}
            {typingUsers.length > 0 && (
              <CombinedTypingIndicator users={typingUsers} style={themeStyles.typingIndicator} />
            )}
            {/* Row for sending messages */}
            <div style={themeStyles.inputRow}>
              <input
                style={themeStyles.input}
                type="text"
                placeholder="Type your message..."
                value={currentMessage}
                onChange={(e) => {
                  setCurrentMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
              />
              <button style={themeStyles.button} onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
