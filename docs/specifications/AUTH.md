# Feature Specification: User Authentication & Session

## 1. Purpose
Provide secure user identity and session context to gate world interactions and associate created entities (characters, regions) with a persistent user.

## 2. Scope
In Scope:
- AWS Amplify / Cognito authentication retrieval in frontend
- Mapping Cognito `userId` to SpaceTimeDB `user` table entry (future)
- Exposing `currentUser` and `currentUserId` via `mainStore`
- Error handling when user is unauthenticated (UI prompts sign-in)
Out of Scope (initial):
- Role-based access control
- Multi-tenant segregation
- Password reset flows (handled by Amplify hosted UI)

## 3. Actors & Preconditions
Actors: Player
Preconditions:
- Player has Cognito account
- Network connectivity to auth provider

## 4. Data Model
Frontend State:
- `currentUserId: string | null` (Amplify)
- `currentUser: User | null` (SpaceTimeDB record, may be resolved post-auth)
Tables (SpaceTimeDB):
- `user_table.ts` defines user entity (fields TBD) linking to characters.
Open Questions:
- How is the Cognito userId mapped? (Normalization rule: store raw ID string)

## 5. Flows
1. App load -> `authenticateUser()` in `mainStore` attempts `getCurrentUser()`
2. If success: set `currentUserId`; attempt subscription/loading SpaceTimeDB `User` row (future augmentation)
3. If fail: set null; UI should route to `Signin.vue`
4. After auth, user may create a character (character reducer uses associated userId)

## 6. Reducer / Function Contracts (Planned)
Future: `ensureUserExists(userId)` reducer to lazily insert user row if absent.
Errors:
- Network / Amplify error -> log warning, provide retry action.

## 7. UI & Store Integration
Components using session:
- `Home.vue`: conditional rendering based on `currentUserId`
- `Signin.vue`: login form or Amplify hosted UI embed
Pinia:
- `mainStore.authenticateUser()` invoked early (root component mount)

## 8. Edge Cases
- Auth token expired mid-session -> need re-auth strategy
- User authenticated but SpaceTimeDB connection fails -> disable gameplay actions
- Cognito user deleted externally -> stale `userId`

## 9. Validation Rules
- `userId` must be non-empty string
- On failed auth, do not attempt character creation reducers

## 10. Metrics
- Auth attempt success rate
- Average time to acquire userId (< 2s target)
- Frequency of auth retries

## 11. Telemetry Hooks (Future)
- Log auth success / failure with timestamp
- correlate character creation events with session age

## 12. Security Considerations
- Store minimal user data client-side
- Avoid leaking user identifiers in logs exposed to other players
- Ensure SpaceTimeDB actions gated by presence of `currentUserId`

## 13. Open Issues
- Implementation of user table synchronization
- Session expiration handling pattern (timer vs event)

## 14. Future Enhancements
- Add roles: admin, moderator
- MFA enforcement
- GDPR / data deletion handling

Status: Draft v0.1
