// client/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Use Render domain for the server (or your own server URL)
const socket = io("https://ychat-lovu.onrender.com/");

// Notification sound (place a notification.mp3 file in your public folder)
const notificationSound = new Audio("notification.mp3");

function App() {
  // Connection states
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
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

  useEffect(() => {
    // Listen for successful join
    socket.on('joinedRoom', (data) => {
      setIsJoined(true);
      setJoinError("");
      setMessages(data.messages);
    });

    // Listen for join error
    socket.on('joinError', (error) => {
      setJoinError(error.message);
    });

    // Listen for new chat messages
    socket.on('chatMessage', (msgObj) => {
      setMessages(prev => [...prev, msgObj]);
      // Play sound if the message is not from the current user
      if (msgObj.user !== username) {
        notificationSound.play().catch(err => console.log("Sound error:", err));
      }
    });

    // Listen for updated users list
    socket.on('usersList', (allUsers) => {
      setUsersList(allUsers);
    });

    // Listen for read receipts updates
    socket.on('readReceipt', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, readBy };
        }
        return msg;
      }));
    });

    // Listen for typing indicators
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
    // For each message not read by current user, send read receipt
    messages.forEach(msg => {
      if (!msg.readBy || !msg.readBy.includes(username)) {
        socket.emit('messageRead', { messageId: msg._id, roomName, username });
      }
    });
  }, [messages, roomName, username]);

  // Handle dark mode toggle
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Handle typing events for read receipts and typing indicator
  const handleTyping = () => {
    socket.emit('typing', { roomName, username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { roomName, username });
    }, 2000);
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomName.trim()) {
      alert("Username and Room Name are required!");
      return;
    }
    socket.emit('joinRoom', { roomName, username });
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    socket.emit('chatMessage', { roomName, user: username, text: currentMessage });
    setCurrentMessage("");
    socket.emit('stopTyping', { roomName, username });
  };

  // Styling: Define dynamic styles for dark mode vs light mode
  const themeStyles = {
    container: {
      fontFamily: 'Poppins, sans-serif',
      padding: 20,
      width: '100%',
      backgroundColor: darkMode ? '#121212' : '#f0f0f0',
      color: darkMode ? '#e0e0e0' : '#333'
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
      borderBottom: '1px solid #eee'
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
      maxWidth: '60%',
      padding: 10,
      borderRadius: 6,
      wordWrap: 'break-word',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      fontSize: '0.95rem',
      position: 'relative'
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
      marginLeft: 10,
      color: darkMode ? '#aaa' : '#555'
    },
    readReceipt: {
      fontSize: '0.75rem',
      color: darkMode ? '#ccc' : '#888',
      marginTop: 4
    }
  };

  return (
    <div style={themeStyles.container}>
      <button style={themeStyles.darkModeToggle} onClick={toggleDarkMode}>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      {!isJoined ? (
        <div style={themeStyles.joinContainer}>
          <h1>YChat</h1>
          {joinError && <div style={{ color: 'red' }}>{joinError}</div>}
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
          <button style={themeStyles.button} onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
      ) : (
        <div style={themeStyles.chatContainer}>
          {/* Left Panel: Users */}
          <div style={themeStyles.userPanel}>
            <h3>Users ({usersList.length})</h3>
            {usersList.map((user, idx) => (
              <div key={idx} style={themeStyles.userItem}>
                {user}
              </div>
            ))}
          </div>
          {/* Right Panel: Chat */}
          <div style={themeStyles.chatPanel}>
            <h2>Room: {roomName}</h2>
            <div
              style={themeStyles.messagesPanel}
              ref={messagesPanelRef}
            >
              {messages.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  style={{
                    ...themeStyles.messageItem,
                    alignSelf:
                      msg.user === username ? 'flex-end' : 'flex-start',
                    backgroundColor:
                      msg.user === username
                        ? '#DCF8C6'
                        : darkMode
                        ? '#2a2a2a'
                        : '#F8F8F8'
                  }}
                >
                  <div>
                    <strong>{msg.user}</strong>{' '}
                    <em style={{ marginLeft: 5 }}>{msg.time}</em>
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
              <div style={themeStyles.typingIndicator}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
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
