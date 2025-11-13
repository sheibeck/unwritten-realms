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

### POST /uwengine Endpoint
Request body shape:
```json
{
	"action": "travel",        // create-character | explore | travel | general-action | level-up | unknown
	"message": "Travel from A to B via northern pass",
	"threadId": "optional-existing-thread",
	"context": { "currentRegion": "A", "targetRegion": "B" }
}
```

Sample invocation (PowerShell):
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8787/uwengine -Body (@{ action='travel'; message='Travel from A to B'; context=@{ currentRegion='A'; targetRegion='B' }} | ConvertTo-Json) -ContentType 'application/json'
```

### Response Shape
```json
{
	"assistant": "Region Travel Resolver",
	"assistant_id": "asst_...",
	"threadId": "thread_x",
	"runId": "run_y",
	"output": ["Narrative line 1", "Narrative line 2"],
	"elapsedMs": 1240
}
```

### Internal Flow
1. Map `action` to assistant via `src/engine/assistantMap.ts`.
2. Create or reuse thread.
3. Compose message with action + context JSON.
4. Poll run until `completed`.
5. Aggregate assistant message chunks into `output`.

### Extending
- Add new assistant: update `assistantMap.ts` with ID & purpose.
- Add classification layer: if `action` missing, implement a small heuristic or LLM classifier before routing.
- Streaming: replace polling loop in `gameEngine.process()` with event or incremental fetch for lower latency.
- Audit: record prompt checksum with generated artifact (future enhancement).

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
