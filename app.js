const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
const pastes = new Map();

// Generate UUID v4
function generateId() {
  return crypto.randomUUID();
}

// Get current time (supports x-test-now-ms header for testing)
function getCurrentTime(req) {
  const testTime = req.headers['x-test-now-ms'];
  if (testTime) {
    const parsed = parseInt(testTime, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

// Check if paste is available based on constraints
function isPasteAvailable(paste, currentTime) {
  // Check TTL
  if (paste.expiresAt !== null && currentTime >= paste.expiresAt) {
    return false;
  }
  
  // Check view count (already incremented)
  if (paste.maxViews !== null && paste.viewCount > paste.maxViews) {
    return false;
  }
  
  return true;
}

// Health check endpoint
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Create paste
app.post('/api/pastes', (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;
  
  // Validate content
  if (typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Content is required and must be a non-empty string'
    });
  }
  
  // Validate ttl_seconds if provided
  if (ttl_seconds !== undefined) {
    if (typeof ttl_seconds !== 'number' || ttl_seconds <= 0 || !Number.isFinite(ttl_seconds)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'ttl_seconds must be a positive number'
      });
    }
  }
  
  // Validate max_views if provided
  if (max_views !== undefined) {
    if (typeof max_views !== 'number' || max_views <= 0 || !Number.isInteger(max_views)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'max_views must be a positive integer'
      });
    }
  }
  
  const id = generateId();
  const createdAt = Date.now();
  const expiresAt = ttl_seconds ? createdAt + (ttl_seconds * 1000) : null;
  const maxViews = max_views !== undefined ? max_views : null;
  
  const paste = {
    id,
    content: content.trim(),
    createdAt,
    expiresAt,
    maxViews,
    viewCount: 0
  };
  
  pastes.set(id, paste);
  
  const url = `${req.protocol}://${req.get('host')}/p/${id}`;
  
  res.status(201).json({ id, url });
});

// Retrieve paste (API)
app.get('/api/pastes/:id', (req, res) => {
  const { id } = req.params;
  const paste = pastes.get(id);
  
  if (!paste) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Paste not found or has expired'
    });
  }
  
  const currentTime = getCurrentTime(req);
  
  // Increment view count atomically
  paste.viewCount++;
  
  // Check if paste is still available after incrementing view count
  if (!isPasteAvailable(paste, currentTime)) {
    // Remove the paste from storage
    pastes.delete(id);
    return res.status(404).json({
      error: 'Not found',
      message: 'Paste not found or has expired'
    });
  }
  
  // Calculate views remaining
  const viewsRemaining = paste.maxViews !== null 
    ? Math.max(0, paste.maxViews - paste.viewCount)
    : null;
  
  res.json({
    content: paste.content,
    created_at: paste.createdAt,
    expires_at: paste.expiresAt,
    views_remaining: viewsRemaining
  });
});

// Serve create paste UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve view paste UI
app.get('/p/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`Pastebin server running on http://localhost:${PORT}`);
});