// src/app/utils/chat-utils.ts

import { environment } from '../environments';
import { GroupInviteResponseWS } from '../Interface/GroupInviteResponseWS';
import { GroupInviteWS } from '../Interface/GroupInviteWS';
import { UnseenCountWS } from '../Interface/UnseenCountWS';
import { CryptoService } from '../Service/crypto/crypto.service';

export const DEFAULT_NAME_PALETTE = [
  '#2563EB',
  '#16A34A',
  '#DB2777',
  '#7C3AED',
  '#0EA5E9',
  '#F59E0B',
  '#14B8A6',
  '#EF4444',
  '#A855F7',
  '#10B981',
  '#F97316',
  '#06B6D4',
  '#84CC16',
] as const;

export interface E2EDebugContext {
  chatId?: number;
  mensajeId?: number;
  source?: string;
}

function isE2EDebugEnabled(): boolean {
  try {
    // Por defecto activado. Para silenciar: localStorage.setItem('debugE2E', '0')
    return localStorage.getItem('debugE2E') !== '0';
  } catch {
    return true;
  }
}

function errorToString(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function e2eLog(
  level: 'log' | 'warn' | 'error',
  stage: string,
  ctx?: E2EDebugContext,
  data?: Record<string, unknown>
): void {
  if (!isE2EDebugEnabled()) return;
  const payload = {
    chatId: Number.isFinite(Number(ctx?.chatId)) ? Number(ctx?.chatId) : null,
    mensajeId: Number.isFinite(Number(ctx?.mensajeId))
      ? Number(ctx?.mensajeId)
      : null,
    source: ctx?.source || 'unknown',
    ...(data || {}),
  };
  if (level === 'log') console.log(`[E2E][${stage}]`, payload);
  else if (level === 'warn') console.warn(`[E2E][${stage}]`, payload);
  else console.error(`[E2E][${stage}]`, payload);
}

function parsePossiblySerializedE2EPayload(raw: string): any | null {
  let candidate = String(raw || '').trim();
  if (!candidate) return null;

  for (let i = 0; i < 4; i++) {
    if (!candidate) return null;

    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
      if (typeof parsed === 'string') {
        candidate = parsed.trim();
        continue;
      }
      return null;
    } catch {
      // seguimos con normalizaciones
    }

    const quoted =
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"));
    if (quoted) {
      candidate = candidate.slice(1, -1).trim();
      continue;
    }

    if (candidate.includes('\\"')) {
      const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (unescaped !== candidate) {
        candidate = unescaped.trim();
        continue;
      }
    }

    break;
  }

  return null;
}



/**
 * Descifra el contenido de un mensaje cifrado de extremo a extremo (E2E).
 * Devuelve el texto claro o un mensaje de error si faltan claves.
 */
export async function decryptContenidoE2E(
  contenido: unknown,
  emisorId: number,
  receptorId: number,
  usuarioActualId: number,
  cryptoService: CryptoService,
  debugContext?: E2EDebugContext
): Promise<string> {
  try {
    let payload: any = null;
    let rawString = '';

    if (typeof contenido === 'string') {
      rawString = contenido;
      payload = parsePossiblySerializedE2EPayload(contenido);
      if (!payload) return contenido;
    } else if (contenido && typeof contenido === 'object') {
      payload = contenido;
      rawString = JSON.stringify(contenido);
    } else {
      return String(contenido ?? '');
    }

    if (payload?.type === 'E2E' || payload?.type === 'E2E_GROUP') {
      const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
      const isSender = String(emisorId) === String(usuarioActualId);
      const recMap =
        payload?.type === 'E2E_GROUP' && payload?.forReceptores
          ? payload.forReceptores
          : {};
      const recKeys = Object.keys(recMap || {});

      e2eLog('log', 'decrypt-start', debugContext, {
        payloadType: payload?.type,
        emisorId: Number(emisorId),
        receptorId: Number(receptorId),
        usuarioActualId: Number(usuarioActualId),
        isSender,
        hasForEmisor: typeof payload?.forEmisor === 'string',
        hasForReceptor: typeof payload?.forReceptor === 'string',
        forReceptoresCount: recKeys.length,
        hasCiphertext: typeof payload?.ciphertext === 'string',
        hasIv: typeof payload?.iv === 'string',
      });

      if (!privKeyBase64) {
        e2eLog('warn', 'decrypt-no-private-key', debugContext, {
          usuarioActualId: Number(usuarioActualId),
        });
        return '[Mensaje Cifrado - Sin clave privada local]';
      }

      const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);

      let aesEncryptedBase64: string | undefined;
      if (isSender) {
        aesEncryptedBase64 = payload.forEmisor;
      } else if (payload.type === 'E2E_GROUP') {
        const forReceptores = payload.forReceptores || {};
        const direct =
          forReceptores[String(usuarioActualId)] ??
          forReceptores[usuarioActualId] ??
          payload.forReceptor;
        if (direct) {
          const directSource =
            forReceptores[String(usuarioActualId)] != null
              ? 'forReceptores[string]'
              : forReceptores[usuarioActualId] != null
              ? 'forReceptores[number]'
              : payload.forReceptor != null
              ? 'forReceptor'
              : 'unknown';
          e2eLog('log', 'decrypt-group-direct-key', debugContext, {
            directSource,
          });
          aesEncryptedBase64 = direct;
        } else {
          const candidates = Object.values(forReceptores);
          e2eLog('warn', 'decrypt-group-no-direct-key', debugContext, {
            forReceptoresCount: candidates.length,
            forReceptoresKeys: Object.keys(forReceptores),
          });
          for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (typeof candidate !== 'string') continue;
            try {
              const maybe = await cryptoService.decryptRSA(candidate, myPrivKey);
              if (maybe) {
                aesEncryptedBase64 = candidate;
                e2eLog('log', 'decrypt-group-fallback-key-ok', debugContext, {
                  candidateIndex: i,
                });
                break;
              }
            } catch (err) {
              e2eLog('log', 'decrypt-group-fallback-key-failed', debugContext, {
                candidateIndex: i,
                error: errorToString(err),
              });
            }
          }
        }
      } else {
        aesEncryptedBase64 = payload.forReceptor;
      }

      if (!aesEncryptedBase64) {
        e2eLog('warn', 'decrypt-no-aes-envelope-for-user', debugContext, {
          payloadType: payload?.type,
          hasForEmisor: typeof payload?.forEmisor === 'string',
          hasForReceptor: typeof payload?.forReceptor === 'string',
          forReceptoresKeys: recKeys,
        });
        return '[Mensaje Cifrado - Llave no disponible para este usuario]';
      }

      try {
        let aesRawStr = '';
        try {
          aesRawStr = await cryptoService.decryptRSA(aesEncryptedBase64, myPrivKey);
        } catch (err) {
          e2eLog('error', 'decrypt-rsa-envelope-failed', debugContext, {
            payloadType: payload?.type,
            error: errorToString(err),
          });
          return '[Error de descifrado E2E]';
        }

        let aesKey: CryptoKey;
        try {
          aesKey = await cryptoService.importAESKey(aesRawStr);
        } catch (err) {
          e2eLog('error', 'decrypt-import-aes-key-failed', debugContext, {
            payloadType: payload?.type,
            error: errorToString(err),
          });
          return '[Error de descifrado E2E]';
        }

        let plain = '';
        try {
          plain = await cryptoService.decryptAES(payload.ciphertext, payload.iv, aesKey);
        } catch (err) {
          e2eLog('error', 'decrypt-aes-content-failed', debugContext, {
            payloadType: payload?.type,
            hasCiphertext: typeof payload?.ciphertext === 'string',
            hasIv: typeof payload?.iv === 'string',
            error: errorToString(err),
          });
          return '[Error de descifrado E2E]';
        }

        e2eLog('log', 'decrypt-success', debugContext, {
          payloadType: payload?.type,
        });
        return plain;
      } catch (err) {
        e2eLog('error', 'decrypt-final-step-failed', debugContext, {
          payloadType: payload?.type,
          error: errorToString(err),
        });
        return '[Error de descifrado E2E]';
      }
    }

    return rawString;
  } catch (err) {
    e2eLog('error', 'decrypt-unhandled-error', debugContext, {
      error: errorToString(err),
    });
    return '[Error de descifrado E2E]';
  }
}

export async function decryptPreviewStringE2E(
  contenido: unknown,
  usuarioActualId: number,
  cryptoService: CryptoService,
  debugContext?: E2EDebugContext
): Promise<string> {
  try {
    let payload: any = null;
    let rawString = '';

    if (typeof contenido === 'string') {
      rawString = contenido;
      payload = parsePossiblySerializedE2EPayload(contenido);
      if (!payload) return contenido;
    } else if (contenido && typeof contenido === 'object') {
      payload = contenido;
      rawString = JSON.stringify(contenido);
    } else {
      return String(contenido ?? '');
    }
    const payloadType = String(payload?.type || '').trim().toUpperCase();
    if (
      payloadType !== 'E2E' &&
      payloadType !== 'E2E_GROUP' &&
      payloadType !== 'E2E_AUDIO' &&
      payloadType !== 'E2E_GROUP_AUDIO' &&
      payloadType !== 'E2E_IMAGE' &&
      payloadType !== 'E2E_GROUP_IMAGE'
    ) {
      return rawString;
    }

    if (payloadType === 'E2E_AUDIO' || payloadType === 'E2E_GROUP_AUDIO') {
      const durMs = Number(payload?.audioDuracionMs || 0);
      const durTxt = durMs > 0 ? ` (${formatDuration(durMs)})` : '';
      return `Mensaje de voz${durTxt}`;
    }

    if (payloadType === 'E2E_IMAGE' || payloadType === 'E2E_GROUP_IMAGE') {
      const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
      if (!privKeyBase64) return 'Imagen';
      const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);
      const groupCandidates =
        payloadType === 'E2E_GROUP_IMAGE' && payload.forReceptores
          ? [
              payload.forReceptores[String(usuarioActualId)],
              payload.forReceptores[usuarioActualId],
              ...Object.values(payload.forReceptores),
            ]
          : [];
      const candidates = [
        payload.forReceptor,
        payload.forEmisor,
        ...groupCandidates,
        payload.forAdmin,
      ];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;
        try {
          const aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
          const aesKey = await cryptoService.importAESKey(aesRawStr);
          if (payload?.captionCiphertext && payload?.captionIv) {
            const caption = await cryptoService.decryptAES(
              payload.captionCiphertext,
              payload.captionIv,
              aesKey
            );
            const cleanCaption = String(caption || '').trim();
            if (cleanCaption) return `Imagen: ${cleanCaption}`;
          }
          return 'Imagen';
        } catch {
          // Intentamos con la siguiente llave disponible.
        }
      }
      return 'Imagen';
    }

    if (payload.auditStatus === 'NO_AUDITABLE') {
      return '[Mensaje legado no auditable]';
    }

    const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
    if (!privKeyBase64) {
      e2eLog('warn', 'preview-no-private-key', debugContext, {
        usuarioActualId: Number(usuarioActualId),
      });
      return '[Mensaje Cifrado]';
    }

    const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);

    const groupCandidates =
      payload.type === 'E2E_GROUP' && payload.forReceptores
        ? [
            payload.forReceptores[String(usuarioActualId)],
            payload.forReceptores[usuarioActualId],
            ...Object.values(payload.forReceptores),
          ]
        : [];
    const candidates = [
      payload.forReceptor,
      payload.forEmisor,
      ...groupCandidates,
      payload.forAdmin,
    ];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue;
      try {
        const aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
        const aesKey = await cryptoService.importAESKey(aesRawStr);
        return await cryptoService.decryptAES(payload.ciphertext, payload.iv, aesKey);
      } catch {
        // Intentamos con la siguiente llave disponible.
      }
    }

    e2eLog('warn', 'preview-no-decryptable-envelope', debugContext, {
      payloadType: payload?.type,
    });
    return '[Mensaje Cifrado]';
  } catch (err) {
    e2eLog('error', 'preview-decrypt-error', debugContext, {
      error: errorToString(err),
    });
    return '[Mensaje Cifrado]';
  }
}

export function truncate(text: string, max: number): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max
    ? clean
    : clean.slice(0, Math.max(0, max - 3)) + '...';
}

/** 00:00 desde milisegundos */
export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ====== Helpers binarios / base64 para E2EE (libsignal) ======

export type Bytes = ArrayBuffer | ArrayBufferLike | Uint8Array;



/** Convierte texto a ArrayBuffer (UTF-8). */
export function textToAB(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer;
}





/** Base64 decode (devuelve Uint8Array). */
export function b64d(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}




/**
 * Devuelve una URL reproducible:
 * - Si es absoluta (http/https) o data: => tal cual
 * - Si es relativa (/uploads/...) => la prefija con backendBaseUrl
 */
export function resolveMediaUrl(
  url?: string | null,
  backendBaseUrl?: string
): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('assets/') || url.startsWith('/assets/')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
}

/** (current/total)*100 con límite 0..100 y NaN-safe */
export function clampPercent(
  current?: number | null,
  total?: number | null
): number {
  if (!total || total <= 0) return 0;
  const pct = ((current || 0) / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function isAudioPreviewText(
  preview: string | null | undefined
): boolean {
  if (!preview) return false;
  const t = String(preview).toLowerCase();
  return (
    t.includes('mensaje de voz') ||
    t.includes('[audio]') ||
    /\baudio\b/.test(t)
  );
}
// Extrae duración mm:ss desde "🎤 Mensaje de voz (01:23)" → ms
export function parseAudioDurationMs(
  preview: string | null | undefined
): number | null {
  if (!preview) return null;
  const m = String(preview).match(/\((\d{1,2}):([0-5]\d)\)/);
  if (!m) return null;
  const minutes = parseInt(m[1], 10);
  const seconds = parseInt(m[2], 10);
  return (minutes * 60 + seconds) * 1000;
}

export function isUnseenCountWS(x: any): x is UnseenCountWS {
  return x && typeof x.unseenCount === 'number' && !('inviteId' in x);
}
export function isGroupInviteResponseWS(x: any): x is GroupInviteResponseWS {
  return x && 'inviteId' in x && 'status' in x;
}
export function isGroupInviteWS(x: any): x is GroupInviteWS {
  return x && 'inviteId' in x && !('status' in x);
}

export function avatarOrDefault(
  src?: string | null,
  fallback = 'assets/usuario.png'
): string {
  const s = (src || '').trim();
  return s || fallback;
}

export function isPreviewDeleted(text?: string | null): boolean {
  const t = (text || '').trim().toLowerCase();
  return t === 'mensaje eliminado' || t === 'este mensaje ha sido eliminado';
}

export function formatPreviewText(raw?: string | null): string {
  const t = (raw || '').trim();
  return t.replace(/^mensaje:\s*/i, '');
}

export function isSystemMessageLike(mensaje: any): boolean {
  const tipo = String(mensaje?.tipo || '')
    .trim()
    .toUpperCase();
  const systemTypes = new Set([
    'SYSTEM',
    'SYSTEM_MESSAGE',
    'GROUP_EVENT',
    'EVENT',
    'INFO',
  ]);
  const eventCode = String(mensaje?.systemEvent || mensaje?.evento || '')
    .trim()
    .toUpperCase();

  return (
    systemTypes.has(tipo) ||
    mensaje?.esSistema === true ||
    eventCode === 'GROUP_MEMBER_LEFT'
  );
}

export function joinMembersLine(
  usuarios: Array<{ nombre: string; apellido?: string }> = []
): string {
  return usuarios
    .map((u) => `${u.nombre} ${u.apellido ?? ''}`.trim())
    .join(', ');
}

export function colorForUserId(
  userId: number,
  palette: readonly string[] = DEFAULT_NAME_PALETTE
): string {
  const idx = Math.abs(Number(userId)) % palette.length;
  return palette[idx];
}

export function buildTypingHeaderText(names: string[]): string {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return `${names[0]} est\u00e1 escribiendo...`;
  if (names.length === 2) return `${names[0]} y ${names[1]} est\u00e1n escribiendo...`;
  return `${names[0]}, ${names[1]} y ${
    names.length - 2
  } m\u00e1s est\u00e1n escribiendo...`;
}

/**
 * Devuelve el nombre de un usuario por id buscando en la estructura de chats.
 * No usa `this`, se le pasa `chats`.
 */
export function getNombrePorId(
  chats: any[],
  userId: number
): string | undefined {
  for (const ch of chats || []) {
    if (ch?.esGrupo && Array.isArray(ch.usuarios)) {
      const u = ch.usuarios.find((x: any) => Number(x.id) === Number(userId));
      if (u?.nombre) return u.nombre;
    }
    if (
      !ch?.esGrupo &&
      ch?.receptor &&
      Number(ch.receptor.id) === Number(userId)
    ) {
      return ch.receptor.nombre;
    }
  }
  return undefined;
}

/**
 * Construye el preview de un mensaje en funcion de si es grupo/individual.
 * Es pura: no muta nada; tu decides donde la usas.
 */
export function buildPreviewFromMessage(
  mensaje: any,
  chatItem: any | undefined,
  usuarioActualId: number,
  maxLen = 60
): string {
  if (isSystemMessageLike(mensaje)) {
    const systemText = String(mensaje?.contenido ?? '').trim();
    return truncate(systemText || 'Evento del grupo', maxLen);
  }

  if (mensaje?.activo === false) return 'Mensaje eliminado';
  const isImage =
    String(mensaje?.tipo || '')
      .trim()
      .toUpperCase() === 'IMAGE' ||
    !!mensaje?.imageUrl ||
    !!mensaje?.imageDataUrl;
  if (isImage) {
    const caption = String(mensaje?.contenido ?? '').trim();
    const label = caption ? `Imagen: ${caption}` : 'Imagen';
    return truncate(label, maxLen);
  }
  const texto = String(mensaje?.contenido ?? '').trim();

  if (!chatItem) return truncate(texto, maxLen);

  if (chatItem.esGrupo) {
    const prefijo =
      mensaje.emisorId === usuarioActualId
        ? 'yo: '
        : (mensaje.emisorNombre ||
            getNombrePorId([chatItem], mensaje.emisorId) ||
            'Alguien') + ': ';
    return truncate(prefijo + texto, maxLen);
  } else {
    const prefijo = mensaje.emisorId === usuarioActualId ? 'Tú: ' : '';
    return truncate(prefijo + texto, maxLen);
  }
}

/**
 * Devuelve un nuevo array de chats con el chat chatId actualizado con el preview.
 * No hace side effects (inmutable).
 */
export function updateChatPreview(
  chats: any[],
  chatId: number,
  preview: string,
  lastId?: number | null
): any[] {
  const idx = chats.findIndex((c) => Number(c.id) === Number(chatId));
  if (idx === -1) return chats;

  const updated = {
    ...chats[idx],
    ultimaMensaje: preview,
    lastPreviewId: lastId ?? chats[idx].lastPreviewId,
  };

  const nuevo = [...chats];
  nuevo.splice(idx, 1);
  return [updated, ...nuevo];
}

export function computePreviewPatch(
  mensaje: any,
  chatItem: any | undefined,
  usuarioActualId: number
): { preview: string; fecha: any; lastId: number | null } {
  let preview = 'Sin mensajes aún';

  const esAudio =
    (typeof mensaje?.tipo === 'string' &&
      mensaje.tipo.toUpperCase() === 'AUDIO') ||
    !!mensaje?.audioUrl ||
    !!mensaje?.audioDataUrl;
  const esImagen =
    (typeof mensaje?.tipo === 'string' &&
      mensaje.tipo.toUpperCase() === 'IMAGE') ||
    !!mensaje?.imageUrl ||
    !!mensaje?.imageDataUrl;

  if (isSystemMessageLike(mensaje)) {
    preview = String(mensaje?.contenido ?? '').trim() || 'Evento del grupo';
  } else if (mensaje?.activo === false) {
    preview = 'Mensaje eliminado';
  } else if (chatItem && !chatItem.esGrupo) {
    const pref = mensaje?.emisorId === usuarioActualId ? 'Tú: ' : '';
    if (esAudio) {
      const durMs = Number(mensaje?.audioDuracionMs) || 0;
      const durTxt = durMs ? ` (${formatDuration(durMs)})` : '';
      preview = `${pref}Mensaje de voz${durTxt}`;
    } else if (esImagen) {
      const caption = String(mensaje?.contenido || '').trim();
      preview = `${pref}${caption ? `Imagen: ${caption}` : 'Imagen'}`.trim();
    } else {
      preview = `${pref}${String(mensaje?.contenido ?? '').trim()}`.trim();
    }
  } else {
    const emisorEsActual = Number(mensaje?.emisorId) === Number(usuarioActualId);
    const emisor = String(mensaje?.emisorNombre ?? '').trim();
    const prefix = emisorEsActual ? 'yo: ' : emisor ? `${emisor}: ` : '';
    if (esAudio) {
      const durMs = Number(mensaje?.audioDuracionMs) || 0;
      const durTxt = durMs ? ` (${formatDuration(durMs)})` : '';
      preview = `${prefix}Mensaje de voz${durTxt}`;
    } else if (esImagen) {
      const caption = String(mensaje?.contenido || '').trim();
      preview = `${prefix}${caption ? `Imagen: ${caption}` : 'Imagen'}`;
    } else {
      preview = `${prefix}${String(mensaje?.contenido ?? '')}`;
    }
  }

  const fecha = mensaje?.fechaEnvio ?? chatItem?.ultimaFecha ?? null;
  const lastId = mensaje?.id ?? chatItem?.lastPreviewId ?? null;

  return { preview, fecha, lastId };
}

export function parseAudioPreviewText(txt?: string): {
  isAudio: boolean;
  seconds?: number;
  label?: string;
  fromMe?: boolean;
} {
  const s = (txt || '').trim();
  let label = '';
  let body = s;

  const pref = /^([^:]{1,30}):\s*/.exec(s);
  if (pref) {
    label = pref[1].trim();
    body = s.slice(pref[0].length);
  }

  const isAudio = /Mensaje de voz/i.test(body) || /\baudio\b/i.test(body);

  let seconds: number | undefined;
  const tm = /\((\d{2}):(\d{2})\)/.exec(body);
  if (tm) {
    const mm = parseInt(tm[1], 10);
    const ss = parseInt(tm[2], 10);
    seconds = mm * 60 + ss;
  }

  return {
    isAudio,
    seconds,
    label: label || undefined,
    fromMe:
      label.toLowerCase() === 'yo' ||
      label.toLowerCase() === 'tú' ||
      label.toLowerCase() === 'tu',
  };
}


