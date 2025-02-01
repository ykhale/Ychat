// client/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Use Render domain for the server (or your own server URL)
const socket = io("https://ychat-lovu.onrender.com/");

// Notification sound for new messages (place a file named "notification.mp3" in your public folder)
const notificationSound = new Audio("notification.mp3");

// Helper function: convert timestamp to relative time
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

// Combined typing indicator component with animated ellipsis
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
  // Connection states
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Chat states
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Ref for messages panel for auto-scroll and read receipts
  const messagesPanelRef = useRef(null);

  // Timer for typing indicator debounce
  const typingTimeoutRef = useRef(null);

  // Ref for the join section (for "Get Started Now" scrolling)
  const joinSectionRef = useRef(null);

  useEffect(() => {
    socket.on('joinedRoom', (data) => {
      setIsJoined(true);
      setJoinError("");
      setMessages(data.messages);
    });

    socket.on('joinError', (error) => {
      setJoinError(error.message);
    });

    socket.on('chatMessage', (msgObj) => {
      setMessages(prev => [...prev, msgObj]);
      // Play sound if the message is not from the current user
      if (msgObj.user !== username) {
        notificationSound.play().catch(err => console.log("Sound error:", err));
      }
    });

    socket.on('usersList', (allUsers) => {
      setUsersList(allUsers);
    });

    socket.on('readReceipt', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, readBy };
        }
        return msg;
      }));
    });

    socket.on('userTyping', ({ username: typingUser }) => {
      setTypingUsers(prev => {
        if (!prev.includes(typingUser)) {
          return [...prev, typingUser];
        }
        return prev;
      });
    });
    socket.on('userStopTyping', ({ username: stopUser }) => {
      setTypingUsers(prev => prev.filter(u => u !== stopUser));
    });

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

  // Auto-scroll to bottom and send read receipts when messages update
  useEffect(() => {
    if (messagesPanelRef.current) {
      messagesPanelRef.current.scrollTop = messagesPanelRef.current.scrollHeight;
    }
    messages.forEach(msg => {
      if (!msg.readBy || !msg.readBy.includes(username)) {
        socket.emit('messageRead', { messageId: msg._id, roomName, username });
      }
    });
  }, [messages, roomName, username]);

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

  // Handle avatar file upload; convert to Base64 string
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomName.trim()) {
      alert("Username and Room Name are required!");
      return;
    }
    // Send avatar along with username and room name
    socket.emit('joinRoom', { roomName, username, avatar });
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    socket.emit('chatMessage', { roomName, user: username, text: currentMessage, avatar });
    setCurrentMessage("");
    socket.emit('stopTyping', { roomName, username });
  };

  // Scroll to join form when "Get Started Now" is clicked
  const scrollToJoin = () => {
    if (joinSectionRef.current) {
      joinSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Define dynamic styles (including hero section, footer, dark mode adjustments, etc.)
  const themeStyles = {
    container: {
      fontFamily: 'Poppins, sans-serif',
      padding: 20,
      width: '100%',
      minHeight: '100vh',
      backgroundColor: darkMode ? '#121212' : '#f0f0f0',
      color: darkMode ? '#e0e0e0' : '#333',
      position: 'relative'
    },
    hero: {
      textAlign: 'center',
      marginBottom: 20,
      padding: '40px 20px'
    },
    heroTitle: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      margin: 0
    },
    heroSubtitle: {
      fontSize: '1.2rem',
      color: darkMode ? '#aaa' : '#555'
    },
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
    avatarPreview: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      objectFit: 'cover',
      margin: '10px auto',
      display: 'block'
    },
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
    userPanel: {
      width: '20%',
      borderRight: '1px solid #ccc',
      padding: 10,
      overflowY: 'auto',
      backgroundColor: darkMode ? '#2a2a2a' : '#fefefe'
    },
    userItem: {
      padding: 8,
      marginBottom: 4,
      borderRadius: 4,
      backgroundColor: darkMode ? '#3a3a3a' : '#F9F9F9',
      borderBottom: '1px solid #eee',
      display: 'flex',
      alignItems: 'center'
    },
    userAvatar: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      marginRight: 8,
      objectFit: 'cover'
    },
    chatPanel: {
      width: '80%',
      display: 'flex',
      flexDirection: 'column',
      padding: 10,
      backgroundColor: darkMode ? '#121212' : '#fff'
    },
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
    messageHeader: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 4
    },
    messageAvatar: {
      width: 25,
      height: 25,
      borderRadius: '50%',
      marginRight: 8,
      objectFit: 'cover'
    },
    messageTime: {
      fontSize: '0.8rem',
      color: darkMode ? '#ccc' : '#888',
      marginLeft: 'auto'
    },
    readReceipt: {
      fontSize: '0.75rem',
      color: darkMode ? '#ccc' : '#888',
      marginTop: 4
    },
    inputRow: {
      display: 'flex',
      marginTop: 10
    },
    darkModeToggle: {
      position: 'absolute',
      top: 10,
      right: 10,
      padding: '8px 12px',
      cursor: 'pointer',
      border: 'none',
      borderRadius: 4,
      backgroundColor: '#FF758C',
      color: '#fff'
    },
    typingIndicator: {
      fontStyle: 'italic',
      fontSize: '0.9rem',
      marginTop: 5,
      color: darkMode ? '#aaa' : '#555'
    },
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
    }
  };

  return (
    <div style={themeStyles.container}>
      <button style={themeStyles.darkModeToggle} onClick={toggleDarkMode}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      {!isJoined ? (
        <div ref={joinSectionRef}>
          <div style={themeStyles.joinContainer}>
            <div style={themeStyles.hero}>
              <h1 style={themeStyles.heroTitle}>Welcome to YChat</h1>
              <p style={themeStyles.heroSubtitle}>
                Talk with anyone, anywhere, privately, for free, always.
              </p>
            </div>
            {avatar && <img src={avatar} alt="Avatar Preview" style={themeStyles.avatarPreview} />}
            <input
              style={themeStyles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              style={themeStyles.input}
              type="text"
              placeholder="Room Name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            {/* Use a label to change the default file input text */}
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
          {/* New Footer Description Section */}
          <div style={themeStyles.footer}>
            <h2 style={themeStyles.footerTitle}>Discover YChat</h2>
            <p style={themeStyles.footerText}>
              Enjoy instant messaging without the hassle of creating an account. We respect your privacy—no personal information required!
              Connect with friends or strangers in a secure, fast, and intuitive environment. Experience messaging as it should be.
            </p>
            <button style={themeStyles.button} onClick={scrollToJoin}>
              Get Started Now
            </button>
            {/* Placeholder for images: add your images into public/images and update src attributes */}
            <div style={{ marginTop: 20 }}>
              <img src="/images/privacy.png" alt="Privacy" style={{ width: 80, margin: '0 10px' }} />
              <img src="/images/fast.png" alt="Fast" style={{ width: 80, margin: '0 10px' }} />
              <img src="/images/no-account.png" alt="No Account" style={{ width: 80, margin: '0 10px' }} />
            </div>
          </div>
        </div>
      ) : (
        <div style={themeStyles.chatContainer}>
          {/* Left Panel: Users */}
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
                  <div>{msg.text}</div>
                  {msg.readBy && msg.readBy.length > 0 && (
                    <div style={themeStyles.readReceipt}>
                      Read by: {msg.readBy.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {typingUsers.length > 0 && (
              <CombinedTypingIndicator users={typingUsers} style={themeStyles.typingIndicator} />
            )}
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
