// client/src/App.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Use Render domain for the server
const socket = io("https://ychat-lovu.onrender.com/"); // Replace with your Render server URL

function App() {
  // Connection states
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [passkey, setPasskey] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Chat states
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    // Listen for successful join
    socket.on('joinedRoom', (data) => {
      setIsJoined(true);
      setJoinError("");
      // data contains { roomName, messages: [...] }
      setMessages(data.messages);
    });

    // Listen for join error
    socket.on('joinError', (error) => {
      setJoinError(error.message);
    });

    // Listen for new chat messages
    socket.on('chatMessage', (msgObj) => {
      setMessages((prev) => [...prev, msgObj]);
    });

    // Listen for updated users list
    socket.on('usersList', (allUsers) => {
      setUsersList(allUsers);
    });

    return () => {
      socket.off('joinedRoom');
      socket.off('joinError');
      socket.off('chatMessage');
      socket.off('usersList');
    };
  }, []);

  const handleJoinRoom = () => {
    if (!username.trim() || !roomName.trim()) {
      alert("Username and Room Name are required!");
      return;
    }
    socket.emit('joinRoom', { roomName, passkey: passkey || null, username });
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    // Send a message in this specific room
    socket.emit('chatMessage', { roomName, user: username, text: currentMessage });
    setCurrentMessage("");
  };

  return (
    <div style={styles.container}>
      {!isJoined ? (
        <div style={styles.joinContainer}>
          <h1>YChat (Rooms + Passkeys)</h1>
          {joinError && <div style={{color: 'red'}}>{joinError}</div>}
          <input
            style={styles.input}
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Room Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Passkey (optional)"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
          />
          <button style={styles.button} onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
      ) : (
        <div style={styles.chatContainer}>
          <div style={styles.userPanel}>
            <h3>Users ({usersList.length})</h3>
            {usersList.map((user, idx) => (
              <div key={idx} style={styles.userItem}>
                {user}
              </div>
            ))}
          </div>
          <div style={styles.chatPanel}>
            <h2>Room: {roomName}</h2>
            <div style={styles.messagesPanel}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.messageItem,
                    alignSelf: msg.user === username ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.user === username ? '#DCF8C6' : '#F8F8F8'
                  }}
                >
                  <strong>{msg.user}</strong>
                  <em style={{marginLeft: 5}}>{msg.time}</em>
                  <br />
                  {msg.text}
                </div>
              ))}
            </div>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                type="text"
                placeholder="Type your message..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button style={styles.button} onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal inline styles (updated for a cleaner, more modern look)
const styles = {
  container: {
    fontFamily: 'Poppins, sans-serif',
    padding: 20,
    width: '100%'
  },
  joinContainer: {
    maxWidth: 400,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: '#FFFFFFEE',
    padding: 20,
    borderRadius: 8,
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  input: {
    padding: 10,
    fontSize: '1rem',
    border: '2px solid #a8edea',
    borderRadius: 6,
    outline: 'none',
    marginTop: 4
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
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  userPanel: {
    width: '20%',
    borderRight: '1px solid #ccc',
    padding: 10,
    overflowY: 'auto',
    backgroundColor: '#fefefe'
  },
  chatPanel: {
    width: '80%',
    display: 'flex',
    flexDirection: 'column',
    padding: 10,
    backgroundColor: '#fff'
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
    backgroundColor: '#fafafa'
  },
  messageItem: {
    maxWidth: '60%',
    padding: 10,
    borderRadius: 6,
    wordWrap: 'break-word',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    fontSize: '0.95rem'
  },
  userItem: {
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
    backgroundColor: '#F9F9F9',
    borderBottom: '1px solid #eee'
  },
  inputRow: {
    display: 'flex',
    marginTop: 10
  }
};

export default App;
