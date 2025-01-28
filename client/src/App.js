// client/src/App.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Change to your server’s URL if deployed:
const socket = io("http://localhost:4000"); 

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
    socket.emit('joinRoom', { 
      roomName, 
      passkey: passkey || null, 
      username 
    });
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    // Send a message in this specific room
    socket.emit('chatMessage', {
      roomName,
      user: username,
      text: currentMessage
    });
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
              <div key={idx} style={styles.userItem}>{user}</div>
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
                    backgroundColor: msg.user === username ? '#DCF8C6' : '#F0F0F0'
                  }}
                >
                  <strong>{msg.user}</strong>
                  <em style={{marginLeft: 5}}>{msg.time}</em>
                  <br/>
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

// Minimal inline styles
const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: 20
  },
  joinContainer: {
    maxWidth: 400,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  input: {
    padding: 8
  },
  button: {
    padding: 10,
    cursor: 'pointer'
  },
  chatContainer: {
    display: 'flex',
    flexDirection: 'row',
    height: '80vh',
    maxWidth: 1200,
    margin: 'auto',
    border: '1px solid #ccc',
    borderRadius: 5
  },
  userPanel: {
    width: '20%',
    borderRight: '1px solid #ccc',
    padding: 10,
    overflowY: 'auto'
  },
  chatPanel: {
    width: '80%',
    display: 'flex',
    flexDirection: 'column',
    padding: 10
  },
  messagesPanel: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 10,
    border: '1px solid #ddd'
  },
  messageItem: {
    maxWidth: '60%',
    padding: 10,
    borderRadius: 8,
    wordWrap: 'break-word'
  },
  userItem: {
    padding: 5,
    borderBottom: '1px solid #eee'
  },
  inputRow: {
    display: 'flex',
    marginTop: 10
  }
};

export default App;
