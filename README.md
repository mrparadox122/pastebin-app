# Pastebin-like Application

A simple Pastebin clone that allows users to create and share text pastes with optional expiry and view limits.

## Features

- Create text pastes with optional constraints
- Time-based expiry (TTL in seconds)
- View-count limits
- Shareable URLs
- Clean web interface
- RESTful JSON API

## How to Run Locally

### Prerequisites
- Node.js (v14 or higher)

### Installation & Running

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser to:
```
http://localhost:3000
```

The server runs on port 3000 by default (configurable via `PORT` environment variable).

## Persistence Layer

**In-Memory Storage (JavaScript Map)**

This application uses an in-memory Map as the persistence layer for simplicity and performance. 

**Characteristics:**
- Fast read/write operations (O(1))
- No external dependencies
- Data is lost when the server restarts
- Suitable for demo/testing purposes

**For Production:** Consider using:
- Redis (for in-memory with persistence)
- PostgreSQL/MySQL (for relational storage)
- MongoDB (for document storage)

## Important Design Decisions

### 1. Storage Structure
Each paste is stored with:
```javascript
{
  id: string,           // UUID v4
  content: string,      // The paste text
  createdAt: number,    // Unix timestamp (ms)
  expiresAt: number|null, // Unix timestamp (ms) or null
  maxViews: number|null,  // Max view count or null
  viewCount: number     // Current view count
}
```

### 2. Constraint Handling
- **TTL**: Checked on every retrieval using current time (or `x-test-now-ms` header for testing)
- **View Limits**: Atomically incremented; once reached, paste returns 404
- **Combined Constraints**: Whichever triggers first makes the paste unavailable
- **Deleted on Access**: Expired/view-limited pastes are removed from storage immediately

### 3. Concurrency Safety
- View counting is atomic (increment happens before checking limit)
- Race conditions are handled by checking constraints after incrementing

### 4. API Design
- RESTful endpoints with proper HTTP status codes
- All responses return JSON with `Content-Type: application/json`
- Error responses include descriptive messages

### 5. URL Structure
- API: `/api/*` (healthz, pastes)
- Web UI: `/` (create) and `/p/:id` (view)

## API Endpoints

### Health Check
```
GET /api/healthz
Response: { "status": "ok" }
```

### Create Paste
```
POST /api/pastes
Content-Type: application/json

Body:
{
  "content": "string (required)",
  "ttl_seconds": number (optional),
  "max_views": number (optional)
}

Response (201):
{
  "id": "uuid",
  "url": "http://localhost:3000/p/uuid"
}
```

### Retrieve Paste
```
GET /api/pastes/:id
Header (optional): x-test-now-ms: timestamp

Response (200):
{
  "content": "string",
  "created_at": timestamp,
  "expires_at": timestamp|null,
  "views_remaining": number|null
}

Response (404): Paste not found or constraints triggered
```

## Testing

The application supports the `x-test-now-ms` header for testing time-based expiry without waiting:

```bash
# Create a paste that expires in 10 seconds
curl -X POST http://localhost:3000/api/pastes \
  -H "Content-Type: application/json" \
  -d '{"content":"test","ttl_seconds":10}'

# Test with a future timestamp (11 seconds later)
curl http://localhost:3000/api/pastes/:id \
  -H "x-test-now-ms: $(($(date +%s)*1000 + 11000))"
```

## Project Structure

```
.
├── package.json       # Dependencies and scripts
├── app.js            # Main application server
├── public/           # Static files
│   ├── index.html    # Create paste UI
│   └── view.html     # View paste UI
└── README.md         # This file
```

## License

MIT