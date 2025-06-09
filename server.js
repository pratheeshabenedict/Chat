const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory storage for messages and users
let messages = [];
let users = new Map(); // socketId -> user info
const MAX_MESSAGES = 100;

// Message validation
const validateMessage = (content) => {
  if (!content || typeof content !== 'string') return false;
  if (content.trim().length === 0) return false;
  if (content.length > 500) return false;
  return true;
};

// Sanitize message content
const sanitizeMessage = (content) => {
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

// Basic profanity filter
const profanityFilter = (content) => {
  const badWords = ['spam', 'badword1', 'badword2']; // Add your own
  let filtered = content;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
};

// Rate limiting map
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 30;

const checkRateLimit = (socketId) => {
  const now = Date.now();
  const userLimits = rateLimitMap.get(socketId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  userLimits.count++;
  rateLimitMap.set(socketId, userLimits);
  
  return userLimits.count <= MAX_MESSAGES_PER_WINDOW;
};

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat Server is running',
    activeUsers: users.size,
    totalMessages: messages.length
  });
});

// Set up Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (userData) => {
    try {
      const { username } = userData;
      
      if (!username || username.trim().length === 0 || username.length > 20) {
        socket.emit('error', { message: 'Invalid username' });
        return;
      }

      const sanitizedUsername = sanitizeMessage(username);
      
      // Store user info
      users.set(socket.id, {
        id: socket.id,
        username: sanitizedUsername,
        joinedAt: new Date().toISOString()
      });

      // Send recent messages to new user
      socket.emit('message_history', messages.slice(-50));
      
      // Broadcast user joined
      socket.broadcast.emit('user_joined', {
        username: sanitizedUsername,
        timestamp: new Date().toISOString()
      });

      // Send updated user count
      io.emit('user_count', users.size);
      
      console.log(`${sanitizedUsername} joined the chat`);
    } catch (error) {
      console.error('Error in user_join:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    try {
      const user = users.get(socket.id);
      
      if (!user) {
        socket.emit('error', { message: 'Please join the chat first' });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id)) {
        socket.emit('error', { message: 'Too many messages. Please slow down.' });
        return;
      }

      const { content } = data;
      
      if (!validateMessage(content)) {
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }

      // Create message object
      const message = {
        id: Date.now() + Math.random(), // Simple ID generation
        content: profanityFilter(sanitizeMessage(content)),
        username: user.username,
        timestamp: new Date().toISOString(),
        userId: socket.id
      };

      // Store message
      messages.push(message);
      
      // Keep only recent messages
      if (messages.length > MAX_MESSAGES) {
        messages = messages.slice(-MAX_MESSAGES);
      }

      // Broadcast message to all clients
      io.emit('receive_message', message);
      
    } catch (error) {
      console.error('Error in send_message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: false
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      const user = users.get(socket.id);
      
      if (user) {
        // Remove user
        users.delete(socket.id);
        
        // Clean up rate limiting
        rateLimitMap.delete(socket.id);
        
        // Broadcast user left
        socket.broadcast.emit('user_left', {
          username: user.username,
          timestamp: new Date().toISOString()
        });
        
        // Send updated user count
        io.emit('user_count', users.size);
        
        console.log(`${user.username} left the chat`);
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limits] of rateLimitMap.entries()) {
    if (now > limits.resetTime && !users.has(socketId)) {
      rateLimitMap.delete(socketId);
    }
  }
}, 300000); // Clean up every 5 minutes

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
