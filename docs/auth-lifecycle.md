# Auth Lifecycle

- Client obtains Google ID token (One Tap or OAuth flow).
- Server reducer `login_with_google_id(id_token, device_id)` verifies token, upserts user, issues session token (HS256, 12h).
- Client stores session token; subsequent calls include `Authorization: Bearer <session>`.
- Narrative Service forwards bearer token to Server/SpacetimeDB as needed.
- `logout(account_id)` marks sessions updated (placeholder) and client clears token.
- TODO: Replace stub verification with real Google JWKS validation and refresh logic.
