# Google OAuth Setup Guide

This document describes how to set up Google OAuth for the Unwritten Realms game to enable user login with Google accounts.

## Architecture Overview

```
Client (Vue.js) → Narrative Service (Fastify) → Google OAuth → SpacetimeDB
```

1. **Client**: Prompts user for Google ID token or integrates Google Sign-In button
2. **Narrative Service**: Validates token, creates SpacetimeDB identity, calls `ensure_user` reducer
3. **SpacetimeDB Server**: Stores user in `users` table, creates session

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google+ API**:
   - Click **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**

## Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Select **Web application**
4. Configure:
   - **Authorized JavaScript origins**:
     - `https://localhost:5173` (Vite dev server)
     - `http://localhost:3000` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:8081/auth/callback` (narrative-service)
5. Copy **Client ID** and **Client Secret**

## Step 3: Configure Environment Variables

Create a `.env` file in the project root with:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SPACETIMEDB_URL=http://localhost:3000
NARRATIVE_SERVICE_URL=http://localhost:8081
```

Copy these to `narrative-service/.env` as well for the backend.

## Step 4: Run the Services

### Terminal 1: SpacetimeDB Server
```bash
cd server
spacetime start
```

### Terminal 2: Narrative Service
```bash
cd narrative-service
pnpm dev
```

### Terminal 3: Client (Vue.js)
```bash
cd client
pnpm dev
```

## Step 5: Login Flow

### Development Mode (Simple Token Test)

1. Open https://localhost:5173
2. Click **Sign in with Google**
3. When prompted, enter a test token (or use a real Google ID token)
4. The narrative service will:
   - Validate the token (dev mode skips validation if `GOOGLE_CLIENT_ID=DEV`)
   - Create a SpacetimeDB identity
   - Call `ensure_user` reducer to store the user
   - Return a SpacetimeDB token
5. Client stores token and connects to SpacetimeDB

### Production Mode (Real Google OAuth)

For production, you'll need to integrate a real OAuth 2.0 flow:

**Option A: Use `@react-oauth/google` (for React)**
```bash
npm install @react-oauth/google
```

**Option B: Use Google Identity Services (vanilla JS)**
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

## Data Flow

### User Creation on First Login

```
Google ID Token
    ↓
Narrative Service validates token → gets `sub` (Google User ID)
    ↓
Create SpacetimeDB Identity (using `sub` as claim)
    ↓
Call `ensure_user` reducer with (provider='google', provider_sub=sub, email)
    ↓
SpacetimeDB Server inserts row in `users` table
    ↓
Return SpacetimeDB token to client
    ↓
Client stores token, connects, and streams live data
```

### Session Management

Sessions are tracked in the `sessions` table:
- `account_id`: SpacetimeDB Identity
- `device_id`: Unique device identifier
- `last_seen`: Timestamp of last activity

Update on each login via `login_with_google_id` reducer.

## Debugging

### Check User in Database

```bash
spacetime sql unwrittenrealms "SELECT * FROM users"
spacetime sql unwrittenrealms "SELECT * FROM sessions"
```

### View Narrative Service Logs

The Fastify server logs all requests:
```
[8081/auth/google] POST received
[google-auth.ts] Token validated
```

### Mock Google Token (Dev)

To test without a real Google account:
1. Set `GOOGLE_CLIENT_ID=DEV` in `.env`
2. Narrative service will accept any token and treat it as the Google sub
3. Example token: `test-user-123` → becomes Google ID `test-user-123`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not import spacetime:sys@1.2" | Update SpacetimeDB CLI: `spacetime update` |
| "Invalid audience" | Verify `GOOGLE_CLIENT_ID` matches your OAuth credentials |
| "Unauthorized: JWT is required" | SpacetimeDB connection needs a valid token |
| "CORS error" | Add https://localhost:5173 to OAuth allowed origins |

## Next Steps

- Integrate real Google Sign-In button
- Add user profile picture and name to the UI
- Implement logout and session expiry
- Add multi-device session management
