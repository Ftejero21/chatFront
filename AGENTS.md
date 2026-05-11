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
- Do not expose tokens, secrets, personal data, encrypted payload internals, or backend stack traces in UI, logs, or storage.
- Prefer existing auth guards, interceptors, validation and sanitization patterns.
- Flag any change that weakens validation, sanitization, auth flow, route protection, E2E encryption, or client-side data handling.

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

---

# NEXO Angular frontend context

This repository is the Angular frontend for NEXO, a chat application with individual chats, group chats, E2E encryption, AI helpers, admin/reporting flows, stickers, polls, scheduled messages, video calls, notifications and WebSocket real-time updates.

Backend base URL is configured in `environments.ts`:

- Dev: `http://localhost:8080/Nexo`
- Prod placeholder: `https://tu-backend-produccion.com/TejeChat`

Main routes:

- `/` and `/login` -> `LoginComponent`
- `/inicio` -> `InicioComponent`
- `/administracion` -> `AdministracionComponent`, protected by `AdminGuard`

Main module: `app.module.ts`. This is classic Angular module-based architecture, not standalone-first. Several skeleton components are standalone imports.

---

# Top-level app areas

## Login and session

Files:

- `Components/login/login/login.component.*`
- `Components/login/password-reset/password-reset.component.*`
- `Service/auth/auth.service.ts`
- `Service/auth/auth.interceptor.ts`
- `Service/session/session.service.ts`
- `guards/admin.guard.ts`

Features:

- Login with username/password.
- Google login/register fallback endpoints.
- Registration.
- Password reset with code/timer/cooldowns.
- JWT/token local/session storage.
- `AuthInterceptor` injects auth and handles rate-limit integration.
- `SessionService` clears session artifacts and WebSocket state on logout.
- Admin route must stay protected by `AdminGuard`.

AuthService base endpoint:

- `/api/usuarios`

Important methods:

- `login`
- `loginConGoogle`
- `registro`
- `searchUsuarios`
- `getById`
- `listarActivos`
- `banearUsuario`
- `desbanearUsuario`
- `solicitarDesbaneo`
- `listarSolicitudesDesbaneoAdmin`
- `actualizarEstadoSolicitudDesbaneoAdmin`
- `getDashboardStats`
- `getUsuariosRecientes`
- E2E key methods under `/api/keys` and `/api/usuarios/{id}/e2e/...`

---

# Main chat area: `InicioComponent`

Files:

- `Components/inicio/inicio/inicio.component.ts/html/css`
- Huge component. Avoid broad refactors.
- Prefer targeted diffs and reuse existing helpers.

Responsibilities:

- Chat list and selected conversation.
- Individual/group messages.
- Message composer.
- Message sending/edit/delete/restore.
- E2E decryption/encryption flows.
- Real-time WebSocket events.
- Typing/audio recording indicators.
- Read receipts/double check.
- Reactions.
- Polls.
- Media/file preview.
- Stickers and sticker creation.
- Message scheduling.
- AI quick replies, AI ask, AI summary, AI global search.
- Browser notifications.
- User/group info panels.
- Group invite/leave/admin actions.
- Video call overlay.

Do not move large logic out unless explicitly requested. This file is complex and stateful.

Related chat components:

- `emoji-picker`: emoji/sticker tabs, create sticker action, recent emojis.
- `file-preview-viewer`: image/video/audio/file viewer with zoom and metadata.
- `group-info-panel`: group detail, members, media/files, admin actions.
- `user-info-panel`: user detail, media/files, mute/block/report actions.
- `message-search-panel`: in-chat search.
- `poll-composer`: create polls, AI poll draft.
- `poll-votes-panel`: poll votes display.
- `schedule-message-composer`: schedule messages to users/groups.
- `starred-messages-panel`: starred messages with pagination and effects.
- `sticker-editor-panel`: crop/draw/text/zoom/rotate sticker editor.
- `sticker-collection-popup`: owned stickers.
- `video-call-overlay`: call UI.

---

# Chat service contracts

File: `Service/chat/chat.service.ts`

Base endpoints:

- `/api/chat`
- `/api/mensajes`
- `/api/estado/usuarios`
- `/api/usuarios/admin/reportes/ia`

Important methods:

- `crearChatIndividual`
- `crearChatGrupal`
- `listarTodosLosChats`
- `listarMensajesPorChat`
- `listarMensajesPorChatGrupal`
- `buscarMensajesEnChat`
- `listarConversacionesAdmin`
- `listarMensajesAdminPorChat`
- group detail/admin/member methods
- `eliminarMensaje`, `restaurarMensaje`
- starred messages methods
- pinned message methods
- clear/hide/mute/favorite chat methods
- group closure/report methods
- poll vote methods
- scheduled messages methods
- admin direct messages/email/scheduled email methods
- `descargarReporteIa`

Do not change endpoint paths unless backend contract changes.

---

# Messaging uploads and AI text processing

File: `Service/mensajeria/mensajeria.service.ts`

Base endpoint is `environment.backendBaseUrl`.

Important endpoints:

- `/api/mensajeria/mensajes/marcar-leidos`
- `/api/uploads/audio`
- `/api/uploads/media`
- `/api/uploads/file`
- `/api/uploads/image`
- `/api/uploads/file/download?...`
- `/api/ai/texto`

Responsibilities:

- Mark messages read.
- Upload audio/media/file/image.
- Download attachment blobs.
- AI text transformation.
- E2E/Audit public key envelope support.

Keep upload endpoint fallback order unless asked.

---

# E2E encryption and audit payloads

Files:

- `Service/crypto/crypto.service.ts`
- `Service/e2e-backup/e2e-backup.service.ts`
- AI service uses `CryptoService` and `AuthService.getAuditPublicKey()`.

Important local storage keys/patterns observed in project context:

- user private keys are stored by user id in local/session storage patterns.
- audit public key can be stored as `auditPublicKey`, `publicKey_admin_audit`, `forAdminPublicKey`.

AI encrypted flows:

- Some AI responses include `encryptedPayload` with type like `E2E_AI_SUMMARY`.
- Do not display raw encrypted JSON to user.
- Use existing parse/decrypt/normalize logic.
- Do not remove encryption or send plaintext where existing code uses encrypted payloads.

---

# WebSocket service

File: `Service/WebSocket/web-socket.service.ts`

Socket endpoint:

- `${environment.backendBaseUrl}/ws-chat`

Uses SockJS/STOMP.

Important subscriptions/destinations:

- `/topic/chat.{userId}` individual messages.
- `/topic/chat.grupal.{chatId}` group messages.
- `/topic/chat.reaccion.{userId}` reactions.
- `/topic/estado.{userId}` presence.
- `/topic/leido.{userId}` read receipts.
- `/topic/escribiendo.{userId}` individual typing.
- `/topic/escribiendo.grupo.{chatId}` group typing.
- `/topic/audio.grabando.{userId}` individual audio recording.
- `/topic/audio.grabando.grupo.{chatId}` group audio recording.
- `/topic/notifications.{userId}` notifications.
- `/topic/user/{userId}/bloqueos` blocks.
- `/user/queue/baneos` ban events.
- `/user/queue/chat-cierres` chat closure events.
- `/user/queue/errors` user errors.
- `/user/queue/ai-search-progress` AI progress events.
- `/topic/admin.denuncias` admin complaint events.
- `/topic/admin.solicitudes-desbaneo` admin report/appeal events.
- call topics: `/topic/call.*.{userId}`, `/topic/call.sdp.*.{userId}`, `/topic/call.ice.{userId}`.

Important rules:

- Use existing `ensure...Subscription` methods.
- Respect protected destination validation.
- Keep rate-limit checks before sending WS messages.
- Ignore stale AI progress events by `requestId` in UI.
- Do not let WS progress remount final AI result.

---

# AI service and AI popups

File: `Service/ai/ai.service.ts`

Endpoints:

- `POST /api/ai/resumir-conversacion`
- `POST /api/ai/resumir-conversacion/encrypted`
- `POST /api/ai/respuestas-rapidas`
- `POST /api/ai/generar-borrador-encuesta`
- `POST /api/ai/analizar-denuncia`
- `POST /api/ai/buscar-mensajes/encrypted`

AI components:

- `ai-ask-popup`: ask AI about a message/context.
- `ai-text-assistant-popup`: improve/format/generate text/email.
- `ai-conversation-summary-popup`: summary display.
- `ai-global-message-search-popup`: global intelligent search.
- `admin-email-preview-popup`: email preview.
- `admin-schedule-send-popup`: scheduled send popup.

Primary global search endpoint:

```ts
POST /api/ai/buscar-mensajes/encrypted
```

Request interface:

```ts
AiEncryptedMessageSearchRequest {
  consulta: string;
  requestId?: string;
  maxResultados?: number;
  maxMensajesAnalizar?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  incluirGrupales?: boolean;
  incluirIndividuales?: boolean;
}
```

Important response codes:

- `APP_REPORT_CREATED`: report/queja/incidencia/mejora created from AI.
- `APP_REPORT_STATUS_OK`: user queried status/history of own reports.
- `APP_REPORT_STATUS_EMPTY`: no matching reports.
- Other codes may represent normal message search, complaints, scheduled messages, unread messages, offensive content, etc.

Global popup rules:

- Placeholder: `Pregunta por tus mensajes, reportes, denuncias o incidencias...` or similarly clean.
- No broken Unicode icons. Use existing icon classes.
- Separate progress state from final response state.
- Final result animation runs once per request.
- Do not use WS events to hide/remount final response.
- For normal messages, preserve current message-card rendering.
- For `APP_REPORT_STATUS_OK`, use report timeline rendering only.

---

# APP_REPORT_STATUS_OK rendering contract

Only apply this timeline UI when:

```ts
response.codigo === 'APP_REPORT_STATUS_OK'
```

Do not apply to normal messages, denuncias, scheduled messages, or other AI results.

Each result may contain:

```ts
{
  tipoResultado: 'APP_REPORT_STATUS',
  reporteId: number,
  tipoReporte: string,
  estadoReporte: string,
  motivoReporte: string,
  resolucionMotivoReporte: string | null,
  fechaCreacionReporte: string,
  fechaActualizacionReporte: string,
  historialReporte: AiEncryptedMessageSearchReportHistoryItem[],
  mejorResultadoAproximado?: boolean | null
}
```

History item:

```ts
{
  estadoAnterior?: string | null,
  estadoNuevo?: string | null,
  estadoLabel?: string | null,
  motivo?: string | null,
  resolucionMotivo?: string | null,
  fecha?: string | null,
  adminId?: number | null,
  accion?: string | null
}
```

Critical rules:

- `resultados[]` order from backend is authoritative, currently expected as `reporteId DESC`.
- `historialReporte[]` order from backend is authoritative.
- Frontend must not reorder report cards or history unless explicitly requested.
- Render one card per `reporteId`.
- Inside each card, render `historialReporte` exactly in received order.
- Never show `INDIVIDUAL`, `Chat individual`, `[Mensaje]`, or normal `Ir al chat` for report-status results.
- Show `Ir al chat` only if explicitly needed for `CHAT_CERRADO` and a real chat id exists.
- Use `trackByReporteId` and `trackByHistoryItem`.
- Avoid sorting/grouping in template; prepare view models in TS when response arrives.

Expected timeline style:

- Card: `#f9fafb`, border `#e5e7eb`, radius `1.5rem`, padding.
- Left vertical line: `#e5e7eb`.
- Circle per status:
  - `PENDIENTE`: blue.
  - `EN_REVISION`: amber.
  - `APROBADA`: green.
  - `RECHAZADA`: slate/red dark.
- `MOTIVO:` box: light gray.
- `RESOLUCIÓN:` box only when text exists.
- Hide relevance if null.
- Show `Resultado aproximado` badge when `mejorResultadoAproximado === true`.

State labels:

- `PENDIENTE` -> `Pendiente`
- `EN_REVISION` -> `En revisión`
- `APROBADA`:
  - `INCIDENCIA` / `ERROR_APP` -> `Resuelto`
  - `QUEJA` -> `Atendida`
  - `MEJORA` / `SUGERENCIA` -> `Revisada`
  - `DESBANEO` -> `Aprobada`
  - `CHAT_CERRADO` -> `Reabierto`
  - `OTRO` -> `Revisado`
- `RECHAZADA`:
  - `INCIDENCIA` / `ERROR_APP` -> `Descartado`
  - `QUEJA` -> `Descartada`
  - `MEJORA` / `SUGERENCIA` -> `Descartada`
  - `DESBANEO` -> `Rechazada`
  - `CHAT_CERRADO` -> `No reabierto`
  - `OTRO` -> `Descartado`

---

# Admin area

Main files:

- `Components/administracion/administracion/administracion.component.ts/html/css`
- `Components/administracion/admin-reports-section/*`
- `Components/administracion/admin-complaints-section/*`
- `Components/administracion/admin-message-composer/*`
- `Components/administracion/admin-scheduled-messages/*`
- `Components/administracion/admin-messages-section/*`
- `Components/administracion/admin-scheduled-section/*`
- `Components/shared/admin-pagination/*`

Admin shell responsibilities:

- Dashboard stats and recent users.
- Admin navigation.
- Reports/appeals.
- Complaints/denuncias.
- Admin direct messages/email.
- Scheduled admin messages.
- Admin WS notifications/badges/toasts.

## Admin report endpoints

List:

```http
GET /api/usuarios/admin/solicitudes-desbaneo?page=...&size=...&sort=createdAt,desc&estado=PENDIENTE
```

Stats:

```http
GET /api/usuarios/admin/solicitudes-desbaneo/stats
```

Patch state:

```http
PATCH /api/usuarios/admin/solicitudes-desbaneo/{id}/estado
```

Body:

```json
{
  "estado": "EN_REVISION",
  "resolucionMotivo": null
}
```

Report types:

- `DESBANEO`
- `CHAT_CERRADO`
- `INCIDENCIA`
- `QUEJA`
- `MEJORA`
- `SUGERENCIA`
- `ERROR_APP`
- `OTRO`

States:

- `PENDIENTE`
- `EN_REVISION`
- `APROBADA`
- `RECHAZADA`

Admin reports are generic. Do not treat all reports as desbaneos.

Pending flow:

- `PENDIENTE` card click opens detail popup only.
- Primary action: `Pasar a revisión`.
- PATCH to `EN_REVISION`.
- Close popup, refresh/move card to En revisión.
- Do not automatically open final action SweetAlert after moving to review.

In-review flow:

- `EN_REVISION` card click opens final action popup.
- Positive action maps to `APROBADA`.
- Negative action maps to `RECHAZADA`.

Final states:

- `APROBADA` / `RECHAZADA` should be read-only or reviewed state in UI unless explicitly changed.

Action labels:

- `DESBANEO`: `Desbanear usuario` / `Rechazar desbaneo`.
- `CHAT_CERRADO`: `Reabrir chat` / `No reabrir`.
- `INCIDENCIA`: `Marcar como resuelta` / `Descartar incidencia`.
- `QUEJA`: `Marcar como atendida` / `Descartar queja`.
- `MEJORA`: `Marcar como revisada` / `Descartar mejora`.
- `SUGERENCIA`: `Marcar como revisada` / `Descartar sugerencia`.
- `ERROR_APP`: `Marcar como resuelto` / `Descartar error`.
- `OTRO`: `Marcar como revisado` / `Descartar reporte`.

Never run `applyUserActiveFromAppeal(..., true)` except for `DESBANEO` approved.

Filters must be separate:

- `Pendientes`: only `PENDIENTE`.
- `En revisión`: only `EN_REVISION`.
- Finalized tabs: `APROBADA` / `RECHAZADA` as applicable.
- Do not merge `PENDIENTE + EN_REVISION` in one tab unless explicitly requested.

Popup themes by type:

- `DESBANEO`: blue/indigo.
- `CHAT_CERRADO`: purple.
- `INCIDENCIA`: amber/orange.
- `QUEJA`: yellow/gold.
- `MEJORA`: green.
- `SUGERENCIA`: cyan/teal.
- `ERROR_APP`: red.
- `OTRO`: gray/slate.

## Complaints/denuncias

Files:

- `Components/administracion/admin-complaints-section/*`
- `Service/complaint/complaint.service.ts`

Endpoint base: `/api/usuarios`

Important methods:

- `createComplaint`
- `listAdminComplaints`
- `getAdminComplaintStats`
- `markComplaintAsRead`
- `getAdminComplaintUserExpediente`
- complaint event Subject.

Admin complaints section handles reporter/target labels, moderation type, dates, badges.

## Admin message composer

Files:

- `Components/administracion/admin-message-composer/*`
- Admin email preview and schedule popups.

Responsibilities:

- Audience selection.
- Delivery type selection.
- Email attachments and drag/drop.
- AI assistant popup integration.
- Preview and schedule flows.
- Admin direct messages, bulk email and scheduled email via `ChatService`.

---

# Notifications

Files:

- `Service/Notification/notification.service.ts`
- `Service/Notification/browser-notification.service.ts`

REST endpoint:

- `/api/notifications`

Methods:

- unseen count.
- list.
- mark seen.
- pending notifications.
- resolve.
- mark all seen.

Browser notification service handles permission, hidden page detection, dedupe, body/title building and encrypted-placeholder detection.

---

# Stickers

Files:

- `Service/sticker/sticker.service.ts`
- `Components/inicio/sticker-editor-panel/*`
- `Components/popup/sticker-collection-popup/*`
- `Components/inicio/emoji-picker/*`

Endpoint base:

- `/api/stickers`

Methods:

- `getMyStickers`
- `createSticker`
- `isOwnedByMe`
- `deleteSticker`
- `getStickerArchivoBlob`

Sticker editor supports crop/draw/text/zoom/rotate. Keep pointer/canvas logic precise.

---

# Group invites

File: `Service/GroupInvite/group-invite.service.ts`

Endpoint:

- `/api/group-invites`

Methods:

- create invite.
- accept invite.
- decline invite.

---

# Rate limit handling

File: `Service/rate-limit/rate-limit.service.ts`

Responsibilities:

- Parse HTTP/WS rate-limit errors.
- Maintain cooldowns by HTTP scope and WS destination.
- Emit rate-limit events.
- Used by interceptor and WebSocket service.

Do not bypass rate-limit checks.

---

# Shared UI and utilities

Components:

- `chat-list-skeleton`
- `messages-skeleton`
- `users-table-skeleton`
- `admin-pagination`

Directive:

- `shared/media-stream.directive.ts`

Utils:

- `utils/chat-utils.ts`

Keep skeletons and pagination reusable. Do not duplicate pagination logic if `AdminPaginationComponent` fits.

---

# Interfaces / DTOs

DTOs live in `Interface/`.

Important groups:

- AI: `Ai*DTO`, `AiEncryptedMessageSearchDTO`.
- Auth/user: `AuthRespuestaDTO`, `LoginRequestDTO`, `UsuarioDTO`.
- Chat: `Chat*DTO`, `MensajeDTO`, `MessageSearchDTO`, `StarredMessageDTO`, `ChatPinnedMessageDTO`.
- Group: `GroupDetailDTO`, `GroupInvite*`, `LeaveGroupRequestDTO`, `GroupMediaDTO`.
- Admin reports: `UnbanAppealDTO`, `UnbanAppealEventDTO`.
- Complaints: `UserComplaintDTO`, `UserComplaintEventDTO`, `UserComplaintExpedienteDTO`.
- E2E: `UserE2E*`, `UploadBundleDTO`.
- Notifications: `NotificationDTO`, `NotificationWS`, `UnseenCountWS`.
- Calls: `CallInviteWS`, `CallAnswerWS`, `CallEndWS`.
- Stickers: `StickerDTO`, `ResponseStickerDTO`.

Prefer extending existing interfaces rather than creating duplicate shapes.

---

# Style / implementation preferences

- This project uses large component CSS files. Keep CSS scoped to component unless truly shared.
- Keep naming in Spanish where existing code uses Spanish.
- Preserve backend DTO field names even when legacy names are odd, e.g. `solicitudes-desbaneo` now also represents generic admin reports.
- Avoid introducing new libraries for icons/animations. Use existing FontAwesome/Bootstrap/classes already present.
- Avoid emojis if encoding issues have appeared; prefer icon classes.
- Do not calculate heavy arrays inside templates. Build view models in TypeScript when response arrives.
- Use `trackBy` for repeated dynamic lists, especially AI report timeline and chat messages.
- Do not change route paths or service method signatures without explicit request.

---

# Prompt constraints for this repo

When asked to generate prompts for Codex:

- Keep each prompt under 5000 characters.
- If user asks smaller, obey it.
- Prefer separate frontend/backend prompts.
- Include only relevant contract, files/area, and expected behavior.
- No huge generic context inside prompts; rely on this AGENTS.md.
