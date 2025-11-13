# Non-Functional Requirements (NFR)

## 1. Performance
Targets:
- UI latency for entity creation confirmation < 5s (optimize to < 2s)
- Subscription propagation average < 500ms
- Tick processing (future world engine) < 200ms under light load
- Initial app load (cold) < 4s on broadband

## 2. Scalability
- Region graph must support at least 10k regions without client-side timeouts (pagination / lazy subscription strategy required)
- NPC/Quest counts per region scalable via chunked subscriptions
- Horizontal scaling of SpaceTimeDB nodes (future research)

## 3. Security
- Auth required for all mutation actions
- Minimize PII; store only necessary identifiers
- Enforce future role separation (admin vs player)
- Integrity checks for travel adjacency & reducer input validation

## 4. Reliability & Availability
- Reducers must fail fast with clear error codes
- Client retries for transient connection failures (exponential backoff 3 attempts)
- World engine tick scheduler must tolerate delayed execution and resume deterministically

## 5. Observability
- Structured logs for reducer invocation (success/fail)
- Metrics: creation latency, travel count, tick duration
- Error tracking aggregated by reducer type

## 6. Maintainability
- Specification-driven changes require spec update commit before code merge
- Shared type definitions minimized duplication between TS & C# modules
- Clear modular separation: Auth, Character, Region, Travel, NPC, Quest, World Engine

## 7. Testability
- Stores expose pure functions enabling unit tests (mock connection object)
- Deterministic resolvers planned to allow simulation tests
- Contract tests for schema generation alignment

## 8. Accessibility (A11y)
- Color contrast for region and quest panels meets WCAG AA
- Keyboard navigation for travel selection
- ARIA labels for interactive controls

## 9. Internationalization (i18n) (Future)
- Support for multilingual region / quest descriptions via locale fields

## 10. Compliance & Data Governance
- GDPR deletion path (future): remove user-owned characters, quests
- Audit log retention (future event table)

## 11. Dependencies & Risks
- AWS Amplify availability impacts auth flows
- SpaceTimeDB performance under load unverified at scale

## 12. Versioning
- NFR reviewed quarterly; updates tracked in Git with semantic version tag (e.g., nfr-v1.0.0)

Status: Draft v0.1
