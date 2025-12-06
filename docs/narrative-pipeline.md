# Narrative Pipeline

1. Player enters text in Client.
2. Client calls Narrative Service `/interpret`.
3. Narrative Service produces structured `intent` + `narrative_output`.
4. Intent forwarded to SpacetimeDB reducer `apply_intent`.
5. Server emits `narrative_events`; Client displays stream.
