// client/src/App.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Use Render's deployed backend
const socket = io("https://ychat-lovu.onrender.com", {
  transports: ["websocket", "polling"]
});

function App() {
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    // WebSocket Listeners
    socket.on("joinedRoom", (data) => {
      setIsJoined(true);
      setJoinError("");
      setMessages(data.messages);
    });

    socket.on("joinError", (error) => {
      setJoinError(error.message);
    });

    socket.on("chatMessage", (msgObj) => {
      setMessages((prev) => [...prev, msgObj]);
    });

    socket.on("usersList", (allUsers) => {
      setUsersList(allUsers);
    });

    return () => {
      socket.off("joinedRoom");
      socket.off("joinError");
      socket.off("chatMessage");
      socket.off("usersList");
    };
  }, []);

  const handleJoinRoom = () => {
    if (!username.trim() || !roomName.trim()) {
      alert("Username and Room Name are required!");
      return;
    }
    socket.emit("joinRoom", { roomName, username });
  };

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    socket.emit("chatMessage", { roomName, user: username, text: currentMessage });
    setCurrentMessage("");
  };

  return (
    <div style={styles.container}>
      {!isJoined ? (
        <div style={styles.joinContainer}>
          <h1>YChat 🚀</h1>
          {joinError && <div style={styles.errorText}>{joinError}</div>}
          <input style={styles.input} type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input style={styles.input} type="text" placeholder="Room Name" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
          <button style={styles.button} onClick={handleJoinRoom}>Join Room</button>
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
                <div key={idx} style={{
                  ...styles.messageItem,
                  backgroundColor: msg.user === username ? '#58D68D' : '#AED6F1'
                }}>
                  <strong>{msg.user}</strong>
                  <br /> {msg.text}
                </div>
              ))}
            </div>
            <div style={styles.inputRow}>
              <input style={styles.input} type="text" placeholder="Type your message..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
              <button style={styles.button} onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Improved styling
const styles = {
  container: {
    fontFamily: 'Poppins, sans-serif',
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
    padding: 12,
    fontSize: 16,
    borderRadius: 6,
    border: '1px solid #ccc'
  },
  button: {
    padding: 12,
    fontSize: 16,
    cursor: 'pointer',
    backgroundColor: '#5CDB95',
    color: 'white',
    border: 'none',
    borderRadius: 6
  },
  chatContainer: {
    display: 'flex',
    height: '80vh',
    maxWidth: 1200,
    margin: 'auto'
  },
  messageItem: {
    padding: 10,
    borderRadius: 8,
    wordWrap: 'break-word'
  },
  userPanel: {
    width: '20%',
    padding: 10
  }
};

export default App;
