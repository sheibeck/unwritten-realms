# Specifications Index

This folder contains specification-driven development artifacts for Unwritten Realms.

## Master System Specification
- `SYSTEM.md` – Vision, architecture, domain, glossary, feature index

## Feature Specifications
- `AUTH.md` – User Authentication & Session
- `CHARACTER.md` – Character Management
- `REGION.md` – Region Management
- `TRAVEL.md` – Travel & Exploration
- `NPC.md` – NPC Management
- `QUEST.md` – Quest Management
- `WORLD_ENGINE.md` – World Engine & Spacetime

## Quality & Cross-Cutting
- `NFR.md` – Non-Functional Requirements

## Conventions
Each spec file follows a consistent section layout for clarity and traceability. Update the relevant spec before merging feature code changes.

## AI Prompt & Assistant Integration
The project maintains a curated set of OpenAI Assistant prompt files under `ai/` organized by first token folder naming (e.g. `character/`, `region/`, `world/`).

Prompt files follow a YAML front-matter schema for traceability:

```
---
assistant_id: <remote id>
name: <remote assistant name>
model: <model id>
project: Unwritten-Realms
remote_created_at: <ISO>
remote_updated_at: <ISO>
exported_at: <ISO export timestamp>
checksum: sha256:<hex>
---
<prompt body>
```

Workflow Summary:
1. Author or update remote assistants via tooling in `scripts/openai-mcp-server.ts`.
2. Export all assistants locally with `export-openai-assistants.ts --clear` (regenerates YAML + checksum).
3. Validate integrity using `validate-openai-prompts.ts` (ensures body matches stored checksum).
4. Rename assistants remotely with `update-openai-assistant.ts` then re-export to update local filename & metadata.

Naming Conventions:
- Local filename pattern: `<slug>_prompt.txt` where `<slug>` is the assistant name lowercased, spaces replaced by `_`.
- Folder derived from the first token in the assistant name (split on space or underscore). Example: "Character Level Resolver" -> `ai/character/character_level_resolver_prompt.txt`.

Usage:
- These prompts inform higher-level in-game generation (creation, progression, events) but are not reducers themselves.
- Specs referencing resolvers link back to their prompt file names for clarity.

Integrity & Change Control:
- Any manual edit to a prompt body must be followed by regeneration of the checksum (future script TBD) or re-export from remote.
- The `project: Unwritten-Realms` tag scopes assistants; retag script ensures legacy assistants conform.

## Change Log
| Date | File | Change | Author |
|------|------|--------|--------|
| 2025-11-13 | All initial specs | Draft v0.1 created | AI Assistant |
| 2025-11-13 | README.md | Added AI prompt & assistant integration section | AI Assistant |

## Next Steps
- Flesh out reducer contracts with precise field validations
- Introduce sequence diagrams (PlantUML or Mermaid) in future revisions
- Add test matrix derived from spec edge cases

Status: Draft Index v0.1
