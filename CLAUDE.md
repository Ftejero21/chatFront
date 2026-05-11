# CLAUDE.md — Contexto del proyecto chatFront

## Stack
- Angular (standalone NO — módulo AppModule clásico)
- TypeScript strict
- Bootstrap Icons (`bi bi-*`) + FontAwesome (`fas fa-*`)
- `@stomp/stompjs` + SockJS para WebSocket
- Web Crypto API (RSA-OAEP + AES-GCM E2E)
- Tailwind (config presente pero uso mixto con CSS puro)
- Backend Spring Boot en `http://localhost:8080/Nexo`

---

## Estructura principal

```
src/app/
  Components/
    inicio/inicio/          ← COMPONENTE RAÍZ (>19k líneas). Toda la lógica de chat vive aquí.
    administracion/
      administracion/       ← Panel admin principal
      admin-complaints-section/
      admin-reports-section/   ← Cards de solicitudes de desbaneo
      admin-messages-section/
      admin-scheduled-section/
    popup/
      ai-global-message-search-popup/   ← Buscador IA con WS progress
      ai-ask-popup/
      ai-conversation-summary-popup/
      ai-text-assistant-popup/
      report-user-popup/
      sticker-collection-popup/
      ...
    inicio/
      perfil-usuario/
      poll-composer/
      starred-messages-panel/
      message-search-panel/
      group-info-panel/
      user-info-panel/
      video-call-overlay/
      schedule-message-composer/
      sticker-editor-panel/
      ...
  Service/
    WebSocket/web-socket.service.ts   ← STOMP client único
    ai/ai.service.ts
    mensajeria/mensajeria.service.ts
    auth/auth.service.ts
    crypto/crypto.service.ts
    chat/chat.service.ts
    complaint/complaint.service.ts
    sticker/sticker.service.ts
    session/session.service.ts
  Interface/                          ← DTOs TypeScript
  utils/chat-utils.ts                 ← helpers compartidos (formatDuration, clampPercent, etc.)
  environments.ts
```

---

## WebSocket

- Endpoint: `/ws-chat` (SockJS)
- STOMP broker Spring Boot
- Cliente único en `WebSocketService` — todos los componentes se suscriben a través de él
- Cola personal IA: `/user/queue/ai-search-progress`
- Métodos relevantes:
  ```ts
  suscribirseAProgressoBusquedaIA(handler)
  desuscribirseDeProgressoBusquedaIA()
  ```
- `esperarConexion(fn)` — ejecuta fn cuando STOMP está conectado

---

## Cifrado E2E

- RSA-OAEP 2048 + AES-GCM 256
- `CryptoService`: `encryptRSA/decryptRSA`, `encryptAES/decryptAES`, `encryptAESBinary/decryptAESBinary`
- Clave privada almacenada en `localStorage` como `privateKey_${usuarioId}`
- Payloads de archivos: `E2E_IMAGE`, `E2E_GROUP_IMAGE`, `E2E_AUDIO`, `E2E_GROUP_AUDIO`
- Payload resumen IA: `E2E_AI_SUMMARY` — campos: `type`, `iv`, `ciphertext`, `forEmisor`, `forAdmin`, `forReceptor?`, `forReceptores?`
- `tryDecryptAiEncryptedPayload(raw)` en `inicio.component.ts` — descifra cualquier payload E2E_AI_SUMMARY

---

## Buscador IA (ai-global-message-search-popup)

### Flujo
1. Usuario escribe consulta → `onSubmit()` → genera `requestId` UUID
2. `startLoadingAnimation()` → 3 pasos animados (hidden/active/done/error)
3. Suscribe a `/user/queue/ai-search-progress`
4. Emite `submitted` → padre llama `POST /api/ai/buscar-mensajes/encrypted`
5. HTTP response + WS events coordinados con flags `httpResponseReady` + `wsStepsComplete`
6. Safety fallback 5s si WS no llega

### Estados del checklist
```
'hidden' | 'active' (spinner pulse) | 'done' (✓ verde) | 'error' (✕ rojo)
```

### Pasos WS — búsqueda normal
| step | STARTED | COMPLETED |
|------|---------|-----------|
| ANALYZING_CONTEXT | step[0] active | step[0] done |
| ANALYZING_MESSAGES | step[1] active | step[1] done |
| MESSAGE_FOUND | step[2] active | step[2] done → resolve |
| MESSAGE_NOT_FOUND | step[2] active | step[2] done → resolve |

### Pasos WS — APP_REPORT
Evento shape:
```json
{ "requestId": "...", "target": "APP_REPORT", "phase": "APP_REPORT",
  "status": "STARTED|COMPLETED|FAILED", "message": "...", "tipoReporte": "QUEJA" }
```
- Detectado por `phase === 'APP_REPORT'` o `target === 'APP_REPORT'`
- STARTED → 1.5s delay → step[2] active, label por `tipoReporte`:
  - QUEJA → "Generando queja..."
  - INCIDENCIA / ERROR_APP → "Generando incidencia..."
  - MEJORA / SUGERENCIA → "Generando sugerencia..."
  - DESBANEO → "Generando solicitud..."
  - default → "Generando reporte..."
- COMPLETED → step[2] done "Reporte enviado correctamente" → 1.5s hold → resolve
- FAILED → step[2] error "No se pudo generar el reporte" → 1.5s → stopAnimation
- Deduplicación: `handledAppReportKeys Set<string>` con key `${requestId}:APP_REPORT:${status}`

### Resultados
- Tipo MESSAGE: cards con ngSwitch por `tipoMensaje` (TEXT/AUDIO/IMAGE/STICKER/FILE)
- Tipo COMPLAINT: `tipoResultado.startsWith('COMPLAINT')` o `denunciaId > 0`
  - Card estilo AdministracionComponent con indicador de color, badges, razón, detalle
- `isApproximateResult` → badge amber "Resultado aproximado"
- `resumenBusqueda` + `aiSummary` (encryptedPayload descifrado) → card morada "Respuesta de Nexo IA" con logo `assets/Nexo.svg`
- Estado vacío sin summary → "Sin resultados."

### Inputs/Outputs
```ts
@Input() open, loading, consulta, error, resumenBusqueda, resultados, aiSummary
@Output() closed, consultaChange, submitted({ consulta, requestId }), resultSelected
```

### Estado en inicio.component.ts
```ts
globalMessageSearchConsulta, globalMessageSearchLoading, globalMessageSearchError
globalMessageSearchResumenBusqueda, globalMessageSearchResultados, globalMessageSearchAiSummary
showGlobalMessageSearchPopup
```

---

## Panel Admin — Solicitudes de desbaneo (admin-reports-section)

- Interface: `UnbanAppealDTO` en `Interface/UnbanAppealDTO.ts`
- Campos clave: `id`, `email`, `motivo`, `estado`, `tipoReporte`, `createdAt`, `usuarioNombre`, `usuarioApellido`, `chatId`, `chatNombreSnapshot`
- `tipoReporte` values: `DESBANEO`, `CHAT_CERRADO`, cualquier string del backend
- Chips CSS:
  - `appeal-chip--type-user` → azul (DESBANEO)
  - `appeal-chip--type-group` → naranja (CHAT_CERRADO)
  - `appeal-chip--type-other` → morado (valores desconocidos)
  - `appeal-chip--pending/review/ok/danger` → estado
- `getAppealTipoLabel()` → formatea snake_case a Title Case para tipos desconocidos
- API: `GET /api/usuarios/admin/solicitudes-desbaneo?page=0&size=8&sort=createdAt,desc&estados=PENDIENTE,EN_REVISION`

---

## Estilos clave

### Colores recurrentes
- Indigo/purple gradient (IA): `linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)` border `#c7d2fe`
- Hover cards: `linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)`
- Verde éxito: `#16a34a`
- Rojo error: `#dc2626` / `#b91c1c`
- Texto IA oscuro: `#1e1b4b`

### Clases globales popup IA
- `.ai-global-search-popup__ai-summary` — card morada respuesta IA
- `.ai-global-search-popup__summary-note` — mismo estilo, para resumenBusqueda con resultados
- `.ai-global-search-popup__result` — card resultado con gradiente morado
- `.result-card--animated` — entrada animada `result-card-in`
- `.src-complaint-*` — tarjetas de denuncia (indicator, header, badges, reason, message, footer)
- `.ai-search-step--active/done/error` — estados del checklist de progreso
- `.ai-step-check` (verde ✓) / `.ai-step-pulse` (spinner) / `.ai-step-error` (rojo ✕)

### Logo
- `assets/Nexo.svg` — usado en header del popup y en cards "Respuesta de Nexo IA"
- `.ai-summary-nexo-icon` → 18×18px

---

## Interfaces importantes

### AiEncryptedMessageSearchResult
```ts
mensajeId, chatId, tipoChat ('INDIVIDUAL'|'GRUPAL'), emisorId, nombreEmisor
receptorId?, nombreReceptor?, chatGrupalId?, nombreChatGrupal?
fechaEnvio, contenido, contenidoPayloadOriginal?, motivoCoincidencia, relevancia
tipoMensaje? ('TEXT'|'AUDIO'|'IMAGE'|'STICKER'|'FILE'|'UNKNOWN')
descripcionTipoMensaje?, esMultimedia?, contenidoVisible?, mediaUrl?, mimeType?
nombreArchivo?, imageUrl?, imageMime?, imageNombre?, stickerId?, contentKind?
// COMPLAINT fields:
tipoResultado? ('MESSAGE'|'COMPLAINT'|'COMPLAINT_CREATED'|'COMPLAINT_RECEIVED'|string)
denunciaId?, tipoDenuncia?, estadoDenuncia?, fechaDenuncia?, motivo?, gravedad?
nombreUsuarioDenunciado?
```

### AiEncryptedMessageSearchRequest
```ts
consulta, requestId?, maxResultados?, maxMensajesAnalizar?
fechaInicio?, fechaFin?, incluirGrupales?, incluirIndividuales?
```

### AiEncryptedMessageSearchResponse
```ts
success, codigo, mensaje, resumenBusqueda?, encryptedPayload?, resultados[]
```
- `codigo === 'APP_REPORT_CREATED'` → reporte creado, `resumenBusqueda` tiene el texto

---

## Patrones frecuentes

### ChangeDetection
- Todos los componentes principales usan `ChangeDetectorRef.markForCheck()` tras mutaciones async

### Timers
- `loadingTimers: ReturnType<typeof setTimeout>[]` — siempre limpiar en `stopLoadingAnimation` y `ngOnDestroy`

### Media E2E
- `hydrateVisibleResultAssets()` — descarga + descifra blobs, guarda en `hydratedMediaUrls Map`
- `downloadChatAttachmentBlob(url, chatId, mensajeId, 1)` via `MensajeriaService`

### Usuario actual
```ts
const myId = Number(localStorage.getItem(`usuarioId`) || 0);
const privKey = localStorage.getItem(`privateKey_${myId}`);
```

### Toast
```ts
this.showToast('mensaje', 'success'|'warning'|'danger'|'info', 'Título')
```

---

## Notas importantes

- `inicio.component.ts` es monolítico (>19k líneas) — buscar métodos con Grep antes de editar
- No usar `ngOnPush` — componentes son `Default` salvo indicación
- `$event.stopPropagation()` siempre en clicks dentro de cards clicables
- `STEP_MIN_MS = 500` — tiempo mínimo por paso WS para que no parpadee
- WS personal queue ya es per-user — no filtrar por `requestId` en eventos de búsqueda normal
- `esperarConexion()` en WebSocketService — usar para suscripciones que necesiten STOMP listo
