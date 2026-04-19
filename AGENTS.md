# Project Instructions

Use Caveman mode by default in this repository at level `Ultra Max`.

- Keep answers terse and technical.
- Drop filler, pleasantries, and hedging.
- Prefer short direct phrasing and fragments when clarity is preserved.
- Default to the shortest useful answer.
- Maximum 2 lines by default.
- Only exceed 2 lines when writing a prompt intended for backend Codex.
- Do not list modified files unless the user explicitly asks.
- Do not include long change summaries by default.
- Keep code, commands, warnings, and irreversible-action confirmations in normal precise language.
- If the user says `stop caveman` or `normal mode`, stop applying this style.

## Frontend defaults

- Prioritize correctness, security, accessibility, and maintainability.
- Prefer minimal diffs. Do not refactor unrelated code.
- Reuse existing services, models, guards, interceptors, shared components, pipes, and utilities before adding new ones.
- Preserve existing routing, architecture, naming, and UI patterns unless there is a strong reason to change them.
- Do not add new dependencies unless strictly necessary and justified.

## Angular rules

- Follow Angular and TypeScript best practices.
- Prefer strong typing. Avoid `any` unless unavoidable.
- Keep components focused. Move reusable logic to services, utils, or shared modules only when repetition is clear.
- Do not put complex business logic in templates.
- Prefer reactive patterns already used by the repository.
- Keep HTML, TypeScript, and styles aligned and complete when modifying a component.
- Do not break existing inputs, outputs, selectors, routes, or public service contracts unless explicitly required.
- Preserve compatibility with the current Angular version and repository conventions.

## UI and UX rules

- Preserve responsive behavior.
- Preserve accessibility basics: labels, keyboard usability, semantic structure, and visible states.
- Do not change copy, layout, or visual behavior beyond the requested scope.
- Prefer small, predictable UI changes over broad redesigns.

## Security rules

- Treat all external and user input as untrusted.
- Do not expose tokens, secrets, personal data, or internal errors in UI, logs, or storage.
- Prefer existing auth guards, interceptors, and validation patterns.
- Flag any change that weakens validation, sanitization, auth flow, route protection, or client-side data handling.

## Verification

- Verify TypeScript correctness before finishing.
- Verify Angular template bindings for compile-time issues.
- Do not run unit tests unless explicitly requested.
- If validation is needed, prefer static review and compile-time checks only.
- Do not list modified files unless explicitly asked.
- Report only result, blocking risk, or next action.

## Done criteria

- Change is implemented.
- No unrelated files touched.
- No obvious UI, typing, or security regression introduced.
- Code follows repository conventions.
- Compile-time review passes, or the exact blocker is stated.
