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



/**
 * Descifra el contenido de un mensaje cifrado de extremo a extremo (E2E).
 * Devuelve el texto claro o un mensaje de error si faltan claves.
 */
export async function decryptContenidoE2E(
  contenido: string,
  emisorId: number,
  receptorId: number,
  usuarioActualId: number,
  cryptoService: CryptoService
): Promise<string> {
  try {
    if (contenido && contenido.startsWith('{') && contenido.includes('"type":"E2E"')) {
      const payload = JSON.parse(contenido);

      if (payload.type === 'E2E') {
        const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
        if (!privKeyBase64) return '🔒 [Mensaje Cifrado - Sin clave privada local]';

        const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);

        const isSender = String(emisorId) === String(usuarioActualId);
        const aesEncryptedBase64 = isSender ? payload.forEmisor : payload.forReceptor;

        if (!aesEncryptedBase64) {
          return '🔒 [Mensaje Cifrado - Llave no disponible para este usuario]';
        }

        const aesRawStr = await cryptoService.decryptRSA(aesEncryptedBase64, myPrivKey);
        const aesKey = await cryptoService.importAESKey(aesRawStr);
        return await cryptoService.decryptAES(payload.ciphertext, payload.iv, aesKey);
      }
    }
  } catch {
    return '🔒 [Error de descifrado E2E]';
  }

  return contenido;
}

export async function decryptPreviewStringE2E(
  contenido: string,
  usuarioActualId: number,
  cryptoService: CryptoService
): Promise<string> {
  try {
    if (!contenido || !contenido.startsWith('{') || !contenido.includes('"type":"E2E"')) {
      return contenido;
    }

    const payload = JSON.parse(contenido);
    if (payload.type !== 'E2E') return contenido;

    if (payload.auditStatus === 'NO_AUDITABLE') {
      return '⚠️ [Mensaje legado no auditable]';
    }

    const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
    if (!privKeyBase64) return '🔒 [Mensaje Cifrado]';

    const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);

    let aesRawStr: string | undefined;

    for (const candidate of [payload.forAdmin, payload.forReceptor, payload.forEmisor]) {
      if (!candidate) continue;
      try {
        aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
        if (aesRawStr) break;
      } catch {
        // Intentamos con la siguiente llave disponible.
      }
    }

    if (!aesRawStr) return '🔒 [Mensaje Cifrado]';

    const aesKey = await cryptoService.importAESKey(aesRawStr);
    return await cryptoService.decryptAES(payload.ciphertext, payload.iv, aesKey);
  } catch {
    return '🔒 [Mensaje Cifrado]';
  }
}

export function truncate(text: string, max: number): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max
    ? clean
    : clean.slice(0, Math.max(0, max - 1)) + '…';
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
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
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
  return t.includes('🎤') || t.includes('[audio]');
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
  if (names.length === 1) return `${names[0]} está escribiendo…`;
  if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`;
  return `${names[0]}, ${names[1]} y ${
    names.length - 2
  } más están escribiendo…`;
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
 * Construye el preview de un mensaje en función de si es grupo/individual.
 * Es pura: no muta nada; tú decides dónde la usas.
 */
export function buildPreviewFromMessage(
  mensaje: any,
  chatItem: any | undefined,
  usuarioActualId: number,
  maxLen = 60
): string {
  if (mensaje?.activo === false) return 'Mensaje eliminado';
  const texto = String(mensaje?.contenido ?? '').trim();

  if (!chatItem) return truncate(texto, maxLen);

  if (chatItem.esGrupo) {
    const prefijo =
      mensaje.emisorId === usuarioActualId
        ? 'Tú: '
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
 * Devuelve un nuevo array de chats con el chat `chatId` actualizado con el preview.
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

  if (mensaje?.activo === false) {
    preview = 'Mensaje eliminado';
  } else if (chatItem && !chatItem.esGrupo) {
    // INDIVIDUAL
    const pref = mensaje?.emisorId === usuarioActualId ? 'Tú: ' : '';
    if (esAudio) {
      const durMs = Number(mensaje?.audioDuracionMs) || 0;
      const durTxt = durMs ? ` (${formatDuration(durMs)})` : '';
      preview = `${pref}🎤 Mensaje de voz${durTxt}`;
    } else {
      preview = `${pref}${String(mensaje?.contenido ?? '').trim()}`.trim();
    }
  } else {
    // GRUPAL
    const emisor = String(mensaje?.emisorNombre ?? '').trim();
    const prefix = emisor ? `${emisor}: ` : '';
    if (esAudio) {
      const durMs = Number(mensaje?.audioDuracionMs) || 0;
      const durTxt = durMs ? ` (${formatDuration(durMs)})` : '';
      preview = `${prefix}🎤 Mensaje de voz${durTxt}`;
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
  label?: string;   // <-- NUEVO
  fromMe?: boolean; // <-- opcional
} {
  const s = (txt || '').trim();
  let label = '';
  let body = s;

  // Extrae prefijo "X: " (máx ~30 chars para evitar matches absurdos)
  const pref = /^([^:]{1,30}):\s*/.exec(s);
  if (pref) {
    label = pref[1].trim();      // "Tú" o "Ana"
    body = s.slice(pref[0].length);
  }

  const isAudio = /🎤\s*Mensaje de voz/i.test(body);

  let seconds: number | undefined;
  const tm = /\((\d{2}):(\d{2})\)/.exec(body);
  if (tm) {
    const mm = parseInt(tm[1], 10);
    const ss = parseInt(tm[2], 10);
    seconds = mm * 60 + ss;
  }

  return { isAudio, seconds, label: label || undefined, fromMe: label === 'Tú' };
}
