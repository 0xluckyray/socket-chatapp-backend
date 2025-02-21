const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const jwt = require('jsonwebtoken');
const config = require('config');

const User = require("./models/User");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Connect Database
connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/users", require("./routes/api/users"));

// Store connected users and messages
const users = new Map();
const messages = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("authenticate", async (userId, token) => {
    try {
      jwt.verify(token, config.get('jwtSecret'), (error, decoded) => {
          if (error) {
            console.error("Invalid token");
            socket.emit("Invalid Token");
            socket.disconnect();
            return;
          }
          else{
            console.log("Uuuuuuuuuu", decoded.user);
            const user = User.find((u) => u.id == decoded.user);
            if (!user) {
              socket.emit("authenticationFailed");
              socket.disconnect();
              return;
            }
            console.log("authenticated!");
            socket.emit("authenticated"); 
            users.set(socket.id, { userId, username: user.username });
            io.emit("userList", Array.from(users.values()));
          }
      });
      
      // socket.user = user; // Associate user with socket
      // socket.join("chatroom"); // Join the chatroom
      // socket.emit("authenticated");
      // io.to("chatroom").emit("userJoined", user.username); // Notify other users
      
    } catch (error) {
      socket.emit("authenticationFailed");
      socket.disconnect();
    }
  });

  socket.on("join", ({ userId, username }) => {
    console.log('joined', username);
    
    users.set(socket.id, { userId, username });
    io.emit("userList", Array.from(users.values()));
  });

  socket.on("sendMessage", ({ content, channelId, serverId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString(),
      sender: {
        name: user.username,
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop",
      },
    };

    // Store message
    const key = serverId
      ? `server:${serverId}:${channelId}`
      : `dm:${channelId}`;
    if (!messages.has(key)) {
      messages.set(key, []);
    }
    messages.get(key).push(message);

    // Broadcast to room
    io.emit("newMessage", { message, channelId, serverId });
  });

  socket.on("joinChannel", ({ channelId, serverId }) => {
    const roomId = serverId
      ? `server:${serverId}:${channelId}`
      : `dm:${channelId}`;
    socket.join(roomId);

    // Send channel history
    const channelMessages = messages.get(roomId) || [];
    socket.emit("channelHistory", {
      messages: channelMessages,
      channelId,
      serverId,
    });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    io.emit("userList", Array.from(users.values()));
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
