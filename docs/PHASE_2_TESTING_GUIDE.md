# Phase 2 Orchestration System - Testing Guide

This guide provides manual testing instructions for the Phase 2 Orchestration Layer, including API examples, WebSocket testing, and troubleshooting.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [API Testing](#api-testing)
4. [WebSocket Testing](#websocket-testing)
5. [GitHub Integration Testing](#github-integration-testing)
6. [Troubleshooting](#troubleshooting)
7. [Known Limitations](#known-limitations)

---

## Prerequisites

- **Node.js** 18+ installed
- **Wrangler CLI** installed (`npm install -g wrangler`)
- **Local D1 Database** setup
- **GitHub Personal Access Token** (for GitHub integration tests)
- **curl** or **Postman** for API testing
- **WebSocket client** (browser console or `wscat`)

## Environment Setup

### 1. Start Local Development Server

```bash
# Start wrangler in local mode
wrangler dev --local --port 8787

# Or use npm script
npm run dev
```

### 2. Setup Local Database

```bash
# Create local D1 database
wrangler d1 create byte-platform-db --local

# Run migrations
npm run db:migrate:local

# Verify tables created
wrangler d1 execute byte-platform-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected tables:
- `orchestration_projects`
- `orchestration_tickets`
- `orchestration_ticket_dependencies`
- `orchestration_ticket_assignments`
- `orchestration_ticket_activity`
- `orchestration_project_context`
- `orchestration_ws_connections`

### 3. Set Environment Variables

Create `.dev.vars` file:

```env
JWT_SECRET=your-jwt-secret-here
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
GITHUB_TOKEN=ghp_your_github_token_here
```

---

## API Testing

### Authentication

All orchestrator endpoints require authentication. Get a JWT token first:

```bash
# Login to get token (adjust endpoint as needed)
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

Save the returned token:
```bash
export TOKEN="eyJhbGc..."
```

### 1. Create Project

**Endpoint:** `POST /api/orchestrator/projects`

```bash
curl -X POST http://localhost:8787/api/orchestrator/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "your-app-id",
    "title": "Test Project"
  }'
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "proj_abc123",
      "appId": "app_xyz",
      "title": "Test Project",
      "status": "analyzing",
      "createdAt": "2025-10-13T14:30:00.000Z"
    },
    "message": "Project created and analysis started"
  }
}
```

Save the project ID:
```bash
export PROJECT_ID="proj_abc123"
```

### 2. Get Project Details

**Endpoint:** `GET /api/orchestrator/projects/:id`

```bash
curl http://localhost:8787/api/orchestrator/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "proj_abc123",
      "title": "Test Project",
      "status": "analyzing",
      "totalTickets": 0,
      "completedTickets": 0
    },
    "tickets": [],
    "dependencies": []
  }
}
```

### 3. Generate Tickets

**Endpoint:** `POST /api/orchestrator/projects/:id/generate`

```bash
curl -X POST http://localhost:8787/api/orchestrator/projects/$PROJECT_ID/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guidance": "Focus on backend features first"
  }'
```

**Expected Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Ticket generation started"
  }
}
```

Wait 5-10 seconds, then check project status again. Status should change to `review`.

### 4. List Tickets

**Endpoint:** `GET /api/orchestrator/tickets`

```bash
# All tickets for project
curl "http://localhost:8787/api/orchestrator/tickets?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl "http://localhost:8787/api/orchestrator/tickets?projectId=$PROJECT_ID&status=pending,ready" \
  -H "Authorization: Bearer $TOKEN"

# Get ready tickets
curl "http://localhost:8787/api/orchestrator/tickets?projectId=$PROJECT_ID&ready=true" \
  -H "Authorization: Bearer $TOKEN"

# Get tickets assigned to me
curl "http://localhost:8787/api/orchestrator/tickets?assignedToMe=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "ticket_123",
        "projectId": "proj_abc123",
        "title": "Project Setup and Configuration",
        "type": "setup",
        "status": "pending",
        "priority": "critical",
        "estimatedHours": 2,
        "orderIndex": 0
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 5,
      "hasMore": false
    }
  }
}
```

Save a ticket ID:
```bash
export TICKET_ID="ticket_123"
```

### 5. Assign Ticket

**Endpoint:** `POST /api/orchestrator/tickets/:id/assign`

```bash
# Assign to self
curl -X POST http://localhost:8787/api/orchestrator/tickets/$TICKET_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Assign to another user
curl -X POST http://localhost:8787/api/orchestrator/tickets/$TICKET_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "developerId": "user_xyz"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "ticket": {
      "id": "ticket_123",
      "status": "assigned",
      "branchName": null
    },
    "branchName": "feat/project-setup-ticket123"
  }
}
```

### 6. Update Ticket

**Endpoint:** `PATCH /api/orchestrator/tickets/:id`

```bash
# Update status
curl -X PATCH http://localhost:8787/api/orchestrator/tickets/$TICKET_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'

# Update actual hours
curl -X PATCH http://localhost:8787/api/orchestrator/tickets/$TICKET_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualHours": 3
  }'

# Update branch name
curl -X PATCH http://localhost:8787/api/orchestrator/tickets/$TICKET_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchName": "feat/my-feature"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "ticket": {
      "id": "ticket_123",
      "status": "in_progress",
      "updatedAt": "2025-10-13T14:35:00.000Z"
    }
  }
}
```

### 7. Approve Project

**Endpoint:** `PATCH /api/orchestrator/projects/:id`

```bash
curl -X PATCH http://localhost:8787/api/orchestrator/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve"
  }'
```

---

## WebSocket Testing

### Using Browser Console

1. Open browser console (F12)
2. Connect to WebSocket:

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8787/api/orchestrator/ws');

// Log events
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = () => console.log('Closed');

// Authenticate
ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'YOUR_JWT_TOKEN_HERE',
    clientType: 'web',
    projectId: 'proj_abc123' // Optional
}));

// Subscribe to project
ws.send(JSON.stringify({
    type: 'subscribe',
    projectId: 'proj_abc123'
}));

// Respond to heartbeat
ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'heartbeat') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
    }
});
```

### Using wscat

Install wscat:
```bash
npm install -g wscat
```

Connect and test:
```bash
wscat -c ws://localhost:8787/api/orchestrator/ws

# After connection, send:
{"type":"authenticate","token":"YOUR_TOKEN","clientType":"web","projectId":"proj_123"}

# Subscribe:
{"type":"subscribe","projectId":"proj_123"}

# Respond to heartbeat:
{"type":"pong","timestamp":"2025-10-13T14:30:00.000Z"}
```

### Expected Messages

**Auth Success:**
```json
{
  "type": "auth_success",
  "userId": "user_123",
  "connectionId": "conn_abc",
  "subscriptions": ["proj_123"],
  "timestamp": "2025-10-13T14:30:00.000Z"
}
```

**Ticket Updated:**
```json
{
  "type": "ticket_updated",
  "projectId": "proj_123",
  "ticketId": "ticket_456",
  "changes": [
    {
      "field": "status",
      "oldValue": "pending",
      "newValue": "in_progress"
    }
  ],
  "updatedBy": {
    "userId": "user_123",
    "displayName": "John Doe",
    "source": "web"
  },
  "timestamp": "2025-10-13T14:30:00.000Z"
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "timestamp": "2025-10-13T14:30:00.000Z"
}
```

---

## GitHub Integration Testing

### Prerequisites

1. Set GitHub token in `.dev.vars`:
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   ```

2. Create a test organization or use personal account

### 1. Create Repository

**Endpoint:** `POST /api/orchestrator/projects/:id/github/create-repo`

```bash
curl -X POST http://localhost:8787/api/orchestrator/projects/$PROJECT_ID/github/create-repo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "repositoryUrl": "https://github.com/user/test-project",
    "cloneUrl": "https://github.com/user/test-project.git",
    "defaultBranch": "main"
  }
}
```

### 2. Create Branch

**Endpoint:** `POST /api/orchestrator/tickets/:id/github/create-branch`

```bash
curl -X POST http://localhost:8787/api/orchestrator/tickets/$TICKET_ID/github/create-branch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. Create Pull Request

**Endpoint:** `POST /api/orchestrator/tickets/:id/github/create-pr`

```bash
curl -X POST http://localhost:8787/api/orchestrator/tickets/$TICKET_ID/github/create-pr \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4. Test Webhook

**Endpoint:** `POST /api/orchestrator/github/webhook`

```bash
# Simulate PR opened
curl -X POST http://localhost:8787/api/orchestrator/github/webhook \
  -H "X-Hub-Signature-256: sha256=test-signature" \
  -H "X-GitHub-Event: pull_request" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "opened",
    "number": 1,
    "pull_request": {
      "number": 1,
      "title": "Test PR",
      "html_url": "https://github.com/test/repo/pull/1"
    }
  }'
```

---

## Troubleshooting

### Database Issues

**Problem:** Tables don't exist

**Solution:**
```bash
# Check migrations
ls migrations/

# Rerun migrations
npm run db:migrate:local

# Verify
wrangler d1 execute byte-platform-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**Problem:** Foreign key constraint errors

**Solution:** Ensure parent records exist before creating child records (e.g., create project before tickets).

### API Issues

**Problem:** 401 Unauthorized

**Solution:**
- Verify JWT token is valid and not expired
- Check Authorization header format: `Bearer <token>`
- Ensure user exists in database

**Problem:** 404 Not Found

**Solution:**
- Verify endpoint URL is correct
- Check if wrangler dev is running
- Verify resource IDs are correct

**Problem:** 500 Internal Server Error

**Solution:**
- Check wrangler dev console for error logs
- Verify database schema is up to date
- Check for missing environment variables

### WebSocket Issues

**Problem:** Connection fails

**Solution:**
- Verify WebSocket URL: `ws://localhost:8787/api/orchestrator/ws`
- Check if server supports WebSocket upgrade
- Ensure firewall isn't blocking WebSocket connections

**Problem:** Authentication fails

**Solution:**
- Verify JWT token is valid
- Check token format in authenticate message
- Ensure token hasn't expired

**Problem:** No messages received

**Solution:**
- Verify subscription to correct project
- Check if updates are actually happening
- Ensure heartbeat responses are being sent

### GitHub Integration Issues

**Problem:** Repository creation fails

**Solution:**
- Verify GitHub token has correct permissions
- Check token isn't expired
- Ensure repository name doesn't already exist

**Problem:** Webhook signature verification fails

**Solution:**
- Verify GITHUB_WEBHOOK_SECRET is set correctly
- Check signature calculation matches GitHub's algorithm
- Ensure webhook payload is valid JSON

---

## Known Limitations

1. **AI Analysis:** AI-powered analysis requires valid AI binding and may timeout on complex prototypes. Falls back to basic ticket generation.

2. **Branch Protection:** Setting up branch protection requires GitHub Pro/Team account. Operation fails gracefully on free accounts.

3. **WebSocket Persistence:** After Durable Object restart, clients must reconnect. Connection metadata is persisted but WebSocket objects cannot be restored.

4. **File Storage:** Prototype file fetching not yet fully implemented. Ticket generation works with mock/sample data.

5. **Rate Limiting:** GitHub API has rate limits (5000 requests/hour for authenticated). Consider caching and batching operations.

6. **Concurrent Updates:** High concurrency may cause race conditions. Consider implementing optimistic locking.

7. **Large Projects:** Projects with 100+ tickets may experience slower generation times. Consider pagination and lazy loading.

---

## Next Steps

After validating Phase 2:

1. **Build Frontend UI** - Create React components for project/ticket management
2. **Add VS Code Extension** - Integrate with developer workflow
3. **Enhance AI Analysis** - Improve feature detection and estimation
4. **Add Team Features** - Team assignments, notifications, reporting
5. **Implement Caching** - Reduce database queries with Redis/KV
6. **Add Analytics** - Track project metrics, velocity, completion rates

---

## Support

For issues or questions:
- Check error logs in wrangler dev console
- Review database state with wrangler d1 execute
- Test endpoints individually before integration
- Use WebSocket inspector in browser DevTools

Happy Testing! 🚀