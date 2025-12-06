# Unwritten Realms - Architecture Overview

- Server: SpacetimeDB module defining tables and reducers.
- Client: Vue 3 SPA connecting to SpacetimeDB and Narrative Service.
- Narrative Service: Fastify server calling OpenAI and validating intents via Zod.
- Shared: Zod schemas and types used across services.
- Infra: Docker Compose for local dev.
