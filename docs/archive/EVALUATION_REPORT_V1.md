## Evaluation Report V1

### Context Updates
- **C-01**: Development will be local on a MacBook Pro (M4 Pro) within a monorepo.
- **C-02**: Target deployment is a single deploy for frontend + backend on Vercel.
- **C-03**: Database will be MongoDB Atlas.
- **C-04**: No authentication in v1; admin functions are local-only.
- **C-05**: LLM system prompts need a baseline with per-model overrides to handle structured output differences.

### Strengths
- **S-01**: End-to-end system flow is fully specified (ingest → transform → model runs → evaluation), reducing ambiguity.
- **S-02**: Canonical vs. model outputs are clearly separated with hash/diff-based comparison logic for auditability.
- **S-03**: Transform profiles are config-driven, enabling rapid iteration without code changes.
- **S-04**: MongoDB collections and indexes are detailed, lowering backend schema risk.
- **S-05**: API surface and DTOs are specified with consistent envelopes and error shapes.
- **S-06**: Admin UI scope and wireframes are explicit, enabling fast implementation alignment.
- **S-07**: Parser pseudocode gives concrete parsing algorithms, reducing implementation drift.
- **S-08**: Narrow v1 scope (no auth) accelerates delivery and de-risks early validation.

### Weaknesses and Strengthening Actions
- **W-01**: Vercel single-deploy monorepo routing/build strategy is unspecified.
  - **A-01**: Define monorepo layout and Vercel build pipeline (root app + API routes or separate packages with a unified build). Document expected runtime (serverless/edge/node) and request/response limits.
- **W-02**: “Local-only admin” lacks explicit operational guardrails.
  - **A-02**: Add environment-gated admin access (e.g., `ADMIN_LOCAL_ONLY=true`) with explicit host allowlist and a development-only middleware guard.
- **W-03**: LLM prompting strategy lacks a baseline system prompt and override mechanism.
  - **A-03**: Define a baseline system prompt template and a per-model override schema in config; include placeholders for output format constraints.
- **W-04**: Structured output differences across LLMs are not captured.
  - **A-04**: Add model capability flags (e.g., `supports_json_schema`, `supports_tool_calls`) and fallback parsing strategies per model.
- **W-05**: Parser edge cases and validation behaviors are only partially defined.
  - **A-05**: Add an “Edge Case Catalog” with known anomalies (missing verse numbers, multi-verse lines, footnotes) and explicit expected behavior.
- **W-06**: Observability is high-level without concrete metrics or environments.
  - **A-06**: Define minimal metrics/logging fields per pipeline stage, and differentiate local vs. Vercel deployment logging targets.
- **W-07**: Vercel server/runtime constraints may conflict with long-running ETL or model runs.
  - **A-07**: Separate long-running jobs into background/async workers or queue-based runs; document expected timeouts and limits.
- **W-08**: Transform profile evolution and backward compatibility is not defined.
  - **A-08**: Add versioning to transform profiles and define migration rules for existing runs/results.

### Priority Recommendations (Maximize Results)
- **P-01**: Formalize the prompt+output schema strategy (**A-03**, **A-04**) to ensure consistent, comparable outputs across models.
- **P-02**: Lock down the Vercel monorepo deployment plan (**A-01**, **A-07**) to avoid late-stage integration surprises.
- **P-03**: Define parsing edge cases and expected behavior (**A-05**) to prevent canonical drift and evaluation noise.

### Resolutions (Best Practices)
- **R-01 (P-01)**: Establish a baseline system prompt contract.
  - **BP-01**: Create a single canonical system prompt template with placeholders for model name, output schema, and strict formatting rules.
  - **BP-02**: Store per-model overrides in config with explicit capability flags (`supports_json_schema`, `supports_tool_calls`, `supports_strict_json`).
  - **BP-03**: Require a deterministic “response envelope” (e.g., `{"version","format","payload","errors"}`) to normalize outputs across models.
  - **BP-04**: Add a validation step that rejects or retries responses that do not conform to the schema.
  - **BP-05**: Keep prompt versioning in the run metadata to allow result reproducibility.

- **R-02 (P-02)**: Define monorepo deploy topology for Vercel.
  - **BP-06**: Choose a single routing model: Vercel app with API routes (preferred) or separate packages with a unified Vercel build target.
  - **BP-07**: Explicitly document the runtime for each route (edge/serverless/node) and align any long-running work to async/background tasks.
  - **BP-08**: Codify build steps and environment variables in one place (Vercel project settings + repo config), including Atlas connection handling.
  - **BP-09**: Add a deployment checklist (build, env, routes, limits) to reduce late-stage failures.

- **R-03 (P-03)**: Formalize parsing edge cases and canonicalization.
  - **BP-10**: Build an “Edge Case Catalog” with input examples and expected outputs; use it as fixtures for parser tests.
  - **BP-11**: Define strict normalization rules (whitespace, punctuation, verse numbering, footnotes, combined verses).
  - **BP-12**: Add a parser validation step that flags ambiguous or lossy transforms and records warnings in run metadata.
