# Unwritten Realms

Persistent, specification-driven collaborative world building. Players create regions, characters, NPCs, and quests inside an evolving simulation powered by SpaceTimeDB and a Vue 3 frontend.

## Stack Overview
| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + TypeScript + Pinia + Vite |
| Backend Runtime | SpaceTimeDB (C# modules) |
| Auth | AWS Amplify / Cognito |
| Tooling | Vitest, TypeScript, Sass |

## Specifications
All feature and system specifications live in `docs/specifications`. Update the relevant spec before merging code that changes behavior or domain models.
- System: `docs/specifications/SYSTEM.md`
- Features: AUTH, CHARACTER, REGION, TRAVEL, NPC, QUEST, WORLD_ENGINE
- Quality: `NFR.md`

## Prerequisites
1. Node.js (LTS 20+ ideally) & npm
2. .NET 8 SDK (for SpaceTimeDB C# modules if build required)
3. SpaceTimeDB CLI installed and on PATH (`spacetimedb`)
4. AWS Amplify credentials / Cognito user pool configured (if testing auth flows)

## Initial Setup
```powershell
git clone https://github.com/sheibeck/unwritten-realms.git
cd unwritten-realms
npm install
```

## SpaceTimeDB Development Workflow
All backend module operations occur in `src/module_bindings/server`.

### 1. Start Local SpaceTimeDB
You must start the local SpaceTimeDB node before deploy/publish or generating client code.
```powershell
cd src/module_bindings/server
spacetimedb-cli start
```
Default bind address should expose WebSocket on `ws://localhost:3000` (adjust if configured differently).

### 2. Generate TypeScript Client Bindings
Run after starting the server to reflect current module schema:
```powershell
spacetimedb-cli generate -l typescript -o ../client
```
This writes/updates TypeScript bindings consumed in the frontend (`src/module_bindings/client`). Commit regenerated code with spec changes.

### 3. Deploy Module (Local/Dev Environment)
Deploy updated module code (after edits to C# source) to the running instance:
```powershell
spacetimedb-cli deploy unwrittenrealms
```

### 4. Publish Module (Make Version Available)
After successful deploy you can publish a version:
```powershell
spacetimedb-cli publish unwrittenrealms
```
Publishing makes the module revision available for others/environments depending on your SpaceTimeDB setup.

### 5. Frontend Development Server
In a separate terminal (root project folder):
```powershell
npm run dev
```
Visit: http://localhost:5173

### Environment Variables (Frontend)
- `VITE_SPACETIMEDB_URI=ws://localhost:3000`

### VS Code Launch (Optional)
Use the compound launch to start SpaceTimeDB + Vite + Browser; update launch config if CLI path differs (currently assumes manual CLI usage).

## Testing
```powershell
npm run test
```
Vitest covers store logic and utilities (expand tests based on spec edge cases).

## AI Game Engine (Assistant Routing)
The previous external n8n workflow has been migrated into the repository as a lightweight HTTP engine that selects an OpenAI Assistant based on an action.

### Prerequisites
1. Set `OPENAI_API_KEY` in your environment (e.g., PowerShell `$Env:OPENAI_API_KEY="sk-..."`).
2. Ensure assistants are exported locally (`npm run mcp:openai` then run export script if needed).

### Start Engine Server
```powershell
npm run engine
```
Runs `scripts/engine-server.ts` (Express) on port `8787` (override with `ENGINE_PORT`).

### Health Check
```powershell
Invoke-RestMethod -Uri http://localhost:8787/health
```

### Assistant Endpoints (/assistant/run & /assistant/stream)
Canonical actions only. Examples: `character.create | region.create | travel.move | world.general | character.level_up | combat.encounter.resolve | quest.create | renown.manage | npc.dialogue.open | unknown`

#### POST /assistant/run
```json
{
  "action": "travel.move",
  "message": "Journey from A to B via the northern pass",
  "threadId": "optional-existing-thread",
  "context": { "currentRegion": "A", "targetRegion": "B" }
}
```

PowerShell example:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8787/assistant/run -Body (@{ action='travel.move'; message='Journey from A to B'; context=@{ currentRegion='A'; targetRegion='B' }} | ConvertTo-Json) -ContentType 'application/json'
```

#### Streaming (POST /assistant/stream)
Sends Server-Sent Events: `meta`, multiple `message` events (chunks), a final `result` with consolidated outputs, then `done`.

```powershell
$body = @{ action='world.general'; message='Describe the shifting sky above the crystal dunes'; context=@{ currentRegion='Crystal Dunes' } } | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri http://localhost:8787/assistant/stream -Body $body -ContentType 'application/json'
```

#### Typical /assistant/run Response
```json
{
  "assistantId": "asst_...",
  "action": "travel.move",
  "threadId": "thread_x",
  "runId": "run_y",
  "output": ["Narrative line 1", "Narrative line 2"]
}
```

#### Internal Flow (run & stream)
1. Map canonical `action` to assistant (`src/engine/assistantMap.ts`).
2. Create or reuse thread.
3. Add user message (includes action + context JSON block).
4. Run assistant; poll (run) or incremental poll emitting SSE (stream).
5. Collect assistant messages into ordered `output` (final `result` on stream).

#### Extending
- Add assistant: update `assistantMap.ts` with canonical action key and metadata.
- Classification: send `action: "auto"` (future expansion—currently heuristic in `classifyAction`).
- Streaming enhancements: tune poll interval or migrate to native OpenAI event streams when available.
- Auditing: add checksum logging for prompt + context package.

## Project Structure (High-Level)
```
src/
	components/        # Vue SFCs (panels, interface)
	stores/            # Pinia stores (character, region, npc, quest, main)
	composables/       # Reusable composition functions (spacetime connection)
	lib/               # Service wrappers (SpacetimeService)
ai/                  # Prompt + schema definitions for resolvers
docs/specifications/ # Specification-driven development artifacts
amplify/             # Amplify backend resources
```

## Contributing Workflow
1. Create / update relevant spec in `docs/specifications` (e.g., REGION.md) and commit.
2. Branch naming: `feature/<short-name>` or `fix/<short-name>`.
3. Implement changes (keep diffs focused; avoid unrelated formatting).
4. Add / update tests (derive edge cases from spec sections 8 & 9).
5. Run `npm run test` and ensure green.
6. Open PR referencing spec changes; include summary, affected reducers/stores.
7. Review ensures spec alignment before merge.

## Code Style & Guidelines
- TypeScript strictness retained (see `tsconfig.json`).
- Prefer Pinia stores for shared reactive state; keep side effects isolated.
- Log with structured prefix icons (already used) but avoid sensitive data.
- Avoid hardcoding auth tokens; use Amplify APIs (`fetchAuthSession`).

## SpaceTimeDB Integration Notes
- Connection logic in `src/lib/spacetimeService.ts` retries until connected and attaches subscriptions.
- Start the server (`spacetimedb-cli start`) before invoking any deploy/publish commands or running the frontend.
- After module schema changes (C#), regenerate client bindings with `spacetimedb-cli generate -l typescript -o ../client`.
- Subscriptions currently bootstrap character and user tables; extend with region/npc/quest if needed.
- Reducer calls must validate presence of active connection.

## Troubleshooting
| Issue | Possible Cause | Action |
|-------|----------------|--------|
| Frontend cannot connect | SpaceTimeDB not running | Start server on :3000 |
| Auth warnings | No Cognito session | Sign in via UI / Amplify hosted page |
| Region creation timeout | Subscription not matching query | Verify reducer link logic & query string |
| Duplicate quest not added | Filtering logic in `characterStore` | Intended (prevents duplicates) |

## Roadmap (Short-Term)
- Add world tick & event resolver (WORLD_ENGINE spec)
- Implement quest status lifecycle & completion
- Introduce energy cost to travel (stats addition)
- Expand test coverage with contract tests vs SpaceTimeDB modules
- Integrate streaming run updates for AI Game Engine
- Persist prompt checksum with generated entities

## License
TBD – Add appropriate license before public distribution.

## Acknowledgements
Built using Vue, SpaceTimeDB SDK, and AWS Amplify.

---
Status: Active Development (spec version draft v0.1) – SpaceTimeDB workflow updated
