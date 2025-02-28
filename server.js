const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const jwt = require("jsonwebtoken");
const config = require("config");

const User = require("./models/User");
const DirectMessage = require("./models/DirectMessage");

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
const userId2SocketId = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ userId, username }) => {
    console.log("joined", username, socket.id);

    // Store user data
    users.set(socket.id, {
      id: userId,
      name: username,
      status: "online",
      lastMessage: "",
      time: "2h",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
      messages: [],
    });

    // Store userId to socketId mapping
    userId2SocketId.set(userId, socket.id);

    // Emit updated user list to all clients
    io.emit("userList", Array.from(users.values()));
  });

  socket.on("sendMessage", async ({ content, channelId, serverId }) => {
    console.log("sendMessage----------->", content, channelId, serverId);
    const user = users.get(socket.id);
    if (!user) return;

    // Find the receiver's socketId using their userId
    const receiverSocketId = userId2SocketId.get(channelId);
    if (!receiverSocketId) {
      console.log("Receiver not found or offline");
      return;
    }

    const message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString(),
      sender: {
        name: user.name,
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop",
      },
      receiverId: channelId,
    };

    // Store message
    const key = serverId
      ? `server:${serverId}:${channelId}`
      : `dm:${user.id}-${channelId}`;
    if (!messages.has(key)) {
      messages.set(key, []);
    }
    messages.get(key).push(message);

    // DM
    if (!serverId) {

      // Store to MongoDB
      const dm = await DirectMessage.findOne({
        $or: [
          { dmid: `dm:${user.id}-${channelId}` },
          { dmid: `dm:${channelId}-${user.id}` },
        ],
      });

      if (!dm) {
        // new DM
        const newDm = new DirectMessage({
          dmid: `dm:${user.id}-${channelId}`,
          messages: [
            {
              id: Date.now().toString(),
              content: content,
              timestamp: new Date().toLocaleTimeString(),
              sender: user.id,
              receiver: channelId,
            },
          ],
        });
        await newDm.save();
      } else {
        // if existing

        dm.messages.push({
          id: Date.now().toString(),
          content: content,
          timestamp: new Date().toLocaleTimeString(),
          sender: user.id,
          receiver: channelId,
        });

        await dm.save();

        // await DirectMessage.findOneAndUpdate(
        //   { dmid: dm.id }, // Find the thread by dmid
        //   {
        //     $push: {
        //       messages: {
        //         id: Date.now().toString(),
        //         content: content,
        //         timestamp: new Date().toLocaleTimeString(),
        //         sender: user.id,
        //         receiver: channelId,
        //       },
        //     },
        //   },
        //   { new: true } // Return the updated document
        // );
      }
    }

    // Emit the message to the receiver
    io.to(receiverSocketId).emit("newMessage", {
      message,
      channelId: user.id,
      serverId,
    });

    // Emit the message back to the sender (optional)
    socket.emit("newMessage", { message, channelId, serverId });

    // // Broadcast to room
    // io.emit("newMessage", { message, channelId, serverId });
  });

  socket.on("joinChannel", async ({ channelId, serverId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomId = serverId
      ? `server:${serverId}:${channelId}`
      : `dm:${user.id}-${channelId}`;
    socket.join(roomId);
    console.log("joinChannel----------->", roomId);

    // Send channel history
    const dm = await DirectMessage.findOne({
      $or: [
        { dmid: `dm:${user.id}-${channelId}` },
        { dmid: `dm:${channelId}-${user.id}` },
      ],
    });

    // const channelMessages = messages.get(roomId) || [];
    const channelMessages = dm?.messages || [];
    messages.set(roomId, channelMessages);

    socket.emit("channelHistory", {
      messages: channelMessages,
      channelId,
      serverId,
    });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      // Remove the userId to socketId mapping
      userId2SocketId.delete(user.id);
    }

    // Remove the user from the users Map
    users.delete(socket.id);

    // Emit updated user list to all clients
    io.emit("userList", Array.from(users.values()));
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
