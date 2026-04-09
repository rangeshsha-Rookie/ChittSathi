const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  generateChatResponse,
  getConversationHistory,
  clearConversationHistory,
  analyzeFace
} = require('../controllers/aiController');

const router = express.Router();

// Setup multer for memory storage (best for Render/HF)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Protect all AI routes with authentication
router.use(protect);

// AI chat routes
router.post('/chat', generateChatResponse);
router.get('/conversation', getConversationHistory);
router.delete('/conversation', clearConversationHistory);

// Face analysis route
router.post('/analyze-face', upload.single('image'), analyzeFace);

module.exports = router;
