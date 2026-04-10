const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

// Debug environment variables
console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT || 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('GOOGLE_AI_API_KEY exists:', !!process.env.GOOGLE_AI_API_KEY);
console.log('GOOGLE_AI_API_KEY length:', process.env.GOOGLE_AI_API_KEY ? process.env.GOOGLE_AI_API_KEY.length : 0);

const authRoutes = require('./routes/authRoutes');
const moodRoutes = require('./routes/moodRoutes');
const profileRoutes = require('./routes/profileRoutes');
const settingRoutes = require('./routes/settingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const mentalHealthRoutes = require('./routes/mentalHealthRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

// Initialize express app
const app = express();

// Middleware
app.use(express.json());

// --- CORS: Allow all origins explicitly (required for Render + Vercel setup) ---
const corsOptions = {
  origin: function (origin, callback) {
    // Allow ALL origins (including Vercel, localhost, mobile, dev tools)
    // This is required because Render does not reliably pass `origin: true`
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200 // Some browsers (IE11) choke on 204 for preflight
};

// Apply CORS middleware globally FIRST
app.use(cors(corsOptions));

// Explicitly handle ALL OPTIONS preflight requests
// This must be BEFORE any route definitions
app.options('*', cors(corsOptions));


// MongoDB connection with improved error handling
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'No URI found');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('Connection details:', {
      uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'No URI found',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ssl: true,
        tlsAllowInvalidCertificates: false,
        retryWrites: true,
        w: 'majority',
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000
      }
    });
    
    // Don't exit process, let server continue without DB
    console.log('Server will continue running, but MongoDB operations will fail');
    return null;
  }
};

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/user/profile', profileRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mental-health', mentalHealthRoutes);
app.use('/api/appointments', appointmentRoutes);

// Config endpoint to serve environment URLs to frontend
app.get('/api/config', (req, res) => {
  res.status(200).json({
    success: true,
    config: {
      backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:5001',
      mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000/predict_emotion'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    database: dbStatus,
    aiEnabled: !!process.env.GOOGLE_AI_API_KEY
  });
});

// Root route for quick deployment verification
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ChittSaathi backend is live',
    endpoints: {
      health: '/health',
      config: '/api/config'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    status: 'error', 
    message: err.message || 'Something went wrong on the server' 
  });
});

// Start server with Socket.io signaling
const PORT = process.env.PORT || 5001;
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: corsOptions
});

// Signaling logic
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      senderId: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      senderId: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      senderId: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Socket.io enabled`);
});
