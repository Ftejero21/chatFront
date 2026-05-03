// src/app/utils/chat-utils.ts

import { environment } from '../environments';
import { GroupInviteResponseWS } from '../Interface/GroupInviteResponseWS';
import { GroupInviteWS } from '../Interface/GroupInviteWS';
import { ChatListItemDTO } from '../Interface/ChatListItemDTO';
import { MensajeDTO } from '../Interface/MensajeDTO';
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

export interface PollOptionPayload {
  id: string;
  text: string;
  voteCount: number;
  voterIds: number[];
  votedByMe?: boolean;
  voters?: PollOptionVoterPayload[];
}

export interface PollOptionVoterPayload {
  userId: number;
  fullName?: string;
  photoUrl?: string;
  votedAt?: string;
}

export interface PollPayloadV1 {
  type: 'POLL_V1';
  pollId?: string | number;
  question: string;
  allowMultiple: boolean;
  options: PollOptionPayload[];
  totalVotes: number;
  statusText?: string;
  createdAt?: string;
  createdBy?: number;
}

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
  if (level === 'log') return;
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

function pickFirstStringValue(source: any, keys: string[]): string {
  if (!source || typeof source !== 'object') return '';
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function extractEnvelopeString(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    const nested = parsePossiblySerializedE2EPayload(trimmed);
    if (nested && typeof nested === 'object') {
      return (
        pickFirstStringValue(nested, [
          'envelope',
          'value',
          'cipher',
          'ciphertext',
          'key',
          'encryptedKey',
          'encryptedAesKey',
          'aesKeyEnvelope',
          'data',
          'forReceptor',
          'forEmisor',
          'forAdmin',
        ]) || trimmed
      );
    }
    return trimmed;
  }
  if (!raw || typeof raw !== 'object') return '';

  return pickFirstStringValue(raw, [
    'envelope',
    'value',
    'cipher',
    'ciphertext',
    'key',
    'encryptedKey',
    'encryptedAesKey',
    'aesKeyEnvelope',
    'data',
  ]);
}

function normalizeE2ERecipientMap(raw: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const keyRaw =
        item?.userId ?? item?.usuarioId ?? item?.idUsuario ?? item?.id ?? item?.uid;
      const key = String(keyRaw ?? '').trim();
      const value = extractEnvelopeString(item);
      if (!key || !value) continue;
      result[key] = value;
    }
    return result;
  }

  if (typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const value = extractEnvelopeString(v);
      if (!value) continue;
      result[String(k)] = value;
    }
  }
  return result;
}

function unwrapE2EPayloadCandidate(raw: any): any {
  let candidate = raw;
  for (let i = 0; i < 3; i++) {
    if (!candidate || typeof candidate !== 'object') return candidate;
    const maybeType = pickFirstStringValue(candidate, [
      'type',
      'payloadType',
      'contentKind',
      'e2eType',
    ])
      .trim()
      .toUpperCase();
    if (maybeType.startsWith('E2E')) return candidate;

    const nested =
      candidate?.payload ??
      candidate?.content ??
      candidate?.contenido ??
      candidate?.messageContent ??
      candidate?.data ??
      candidate?.body;
    if (!nested) return candidate;

    if (typeof nested === 'string') {
      const parsed = parsePossiblySerializedE2EPayload(nested);
      if (!parsed) return candidate;
      candidate = parsed;
      continue;
    }

    if (typeof nested === 'object') {
      candidate = nested;
      continue;
    }
    return candidate;
  }
  return candidate;
}

function normalizeE2EPayloadShape(raw: any): any {
  const candidate = unwrapE2EPayloadCandidate(raw);
  if (!candidate || typeof candidate !== 'object') return candidate;

  const type = pickFirstStringValue(candidate, [
    'type',
    'payloadType',
    'contentKind',
    'e2eType',
  ])
    .trim()
    .toUpperCase();
  if (!type.startsWith('E2E')) return candidate;

  const forReceptores = normalizeE2ERecipientMap(
    candidate?.forReceptores ??
      candidate?.for_receptores ??
      candidate?.forRecipients ??
      candidate?.recipientEnvelopes ??
      candidate?.recipients
  );
  const forEmisor =
    extractEnvelopeString(candidate?.forEmisor) ||
    extractEnvelopeString(candidate?.forSender) ||
    extractEnvelopeString(candidate?.for_emisor) ||
    extractEnvelopeString(candidate?.senderEnvelope);
  const forReceptor =
    extractEnvelopeString(candidate?.forReceptor) ||
    extractEnvelopeString(candidate?.forRecipient) ||
    extractEnvelopeString(candidate?.for_receptor) ||
    extractEnvelopeString(candidate?.recipientEnvelope);
  const forAdmin =
    extractEnvelopeString(candidate?.forAdmin) ||
    extractEnvelopeString(candidate?.adminEnvelope) ||
    extractEnvelopeString(candidate?.for_admin);
  const ciphertext = pickFirstStringValue(candidate, [
    'ciphertext',
    'cipherText',
    'encryptedContent',
    'contenidoCifrado',
  ]);
  const iv = pickFirstStringValue(candidate, [
    'iv',
    'nonce',
    'ivText',
    'iv_base64',
    'ivB64',
  ]);

  return {
    ...candidate,
    type,
    forEmisor: forEmisor || candidate?.forEmisor,
    forReceptor: forReceptor || candidate?.forReceptor,
    forReceptores:
      Object.keys(forReceptores).length > 0
        ? forReceptores
        : candidate?.forReceptores || {},
    forAdmin: forAdmin || candidate?.forAdmin,
    ciphertext: ciphertext || candidate?.ciphertext,
    iv: iv || candidate?.iv,
  };
}

function hasE2EEnvelopeShape(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const ciphertext = String(payload?.ciphertext || '').trim();
  const iv = String(payload?.iv || '').trim();
  if (!ciphertext || !iv) return false;
  const candidates = buildE2EEnvelopeCandidates(payload, -1, false);
  return candidates.length > 0;
}

function extractAesKeyBase64FromRaw(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const nested = parsePossiblySerializedE2EPayload(trimmed);
  if (!nested || typeof nested !== 'object') return trimmed;
  return (
    pickFirstStringValue(nested, [
      'aesKey',
      'aes',
      'key',
      'value',
      'raw',
      'base64',
      'secret',
    ]) || trimmed
  );
}

function buildE2EEnvelopeCandidates(
  payload: any,
  usuarioActualId: number,
  isSender: boolean
): string[] {
  const recMap =
    payload?.forReceptores && typeof payload.forReceptores === 'object'
      ? payload.forReceptores
      : {};
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (candidate: unknown): void => {
    if (typeof candidate !== 'string') return;
    const clean = candidate.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  if (isSender) push(payload?.forEmisor);
  push(recMap?.[String(usuarioActualId)]);
  push(recMap?.[usuarioActualId]);
  push(payload?.forReceptor);
  push(payload?.forEmisor);
  for (const v of Object.values(recMap || {})) push(v);
  push(payload?.forAdmin);
  return out;
}

function normalizeBooleanLike(value: unknown): boolean {
  if (value === true) return true;
  const n = Number(value);
  if (Number.isFinite(n)) return n === 1;
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return text === 'true' || text === 'yes' || text === 'si';
}

function toPositiveInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function parsePollVoterId(raw: any): number {
  const candidate =
    raw?.userId ??
    raw?.usuarioId ??
    raw?.idUsuario ??
    raw?.id ??
    raw?.voterId ??
    raw;
  const id = Number(candidate);
  if (!Number.isFinite(id) || id <= 0) return 0;
  return Math.round(id);
}

function normalizePollVotedAt(raw: any): string | undefined {
  const value = String(
    raw?.votedAt ??
      raw?.voteAt ??
      raw?.votedAtIso ??
      raw?.fechaVoto ??
      raw?.createdAt ??
      raw?.fecha ??
      raw ??
      ''
  ).trim();
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return value;
}

function normalizePollVoter(raw: any): PollOptionVoterPayload | null {
  const userId = parsePollVoterId(raw);
  if (!userId) return null;

  const nombre = String(raw?.nombre ?? '').trim();
  const apellido = String(raw?.apellido ?? '').trim();
  const fullNameRaw = String(raw?.fullName ?? raw?.nombreCompleto ?? '').trim();
  const fullName = fullNameRaw || `${nombre} ${apellido}`.trim() || undefined;

  const photoUrl = String(raw?.photoUrl ?? raw?.foto ?? raw?.avatar ?? '').trim() || undefined;
  const votedAt = normalizePollVotedAt(raw);
  return {
    userId,
    fullName,
    photoUrl,
    votedAt,
  };
}

function mergePollVoterDetails(
  prev: PollOptionVoterPayload | undefined,
  next: PollOptionVoterPayload
): PollOptionVoterPayload {
  if (!prev) return next;
  const prevTs = Date.parse(String(prev.votedAt || ''));
  const nextTs = Date.parse(String(next.votedAt || ''));
  const preferNextTime = Number.isFinite(nextTs) && (!Number.isFinite(prevTs) || nextTs >= prevTs);

  return {
    userId: prev.userId,
    fullName: next.fullName || prev.fullName,
    photoUrl: next.photoUrl || prev.photoUrl,
    votedAt: preferNextTime ? next.votedAt || prev.votedAt : prev.votedAt || next.votedAt,
  };
}

function normalizePollVoters(rawList: any): PollOptionVoterPayload[] {
  if (!Array.isArray(rawList)) return [];
  const byUser = new Map<number, PollOptionVoterPayload>();

  for (const raw of rawList) {
    const normalized = normalizePollVoter(raw);
    if (!normalized) continue;
    const existing = byUser.get(normalized.userId);
    byUser.set(normalized.userId, mergePollVoterDetails(existing, normalized));
  }

  return Array.from(byUser.values());
}

function normalizePollOption(raw: any, index: number): PollOptionPayload | null {
  const text = String(
    raw?.text ?? raw?.texto ?? raw?.label ?? raw?.opcion ?? ''
  ).trim();
  if (!text) return null;
  const idRaw = String(raw?.id ?? raw?.key ?? raw?.codigo ?? '').trim();
  const id = idRaw || `opt_${index + 1}`;

  const voters = normalizePollVoters(
    raw?.voters ??
      raw?.votantesDetalle ??
      raw?.voteUsersDetail ??
      raw?.voteDetails ??
      raw?.votes
  );
  const voterIdsRaw = Array.isArray(raw?.voterIds ?? raw?.votantes ?? raw?.voteUsers)
    ? (raw?.voterIds ?? raw?.votantes ?? raw?.voteUsers)
        .map((x: any) => Number(x))
        .filter((x: number) => Number.isFinite(x) && x > 0)
    : [];
  const voterIds = Array.from(
    new Set<number>([...voterIdsRaw, ...voters.map((v) => Number(v.userId)).filter((v) => v > 0)])
  );
  const voteCountRaw = raw?.voteCount ?? raw?.votos ?? raw?.count;
  const voteCount = Math.max(toPositiveInt(voteCountRaw), voterIds.length);
  const votedByMe = normalizeBooleanLike(raw?.votedByMe ?? raw?.votadoPorMi);
  return {
    id,
    text,
    voteCount,
    voterIds,
    votedByMe: votedByMe ? true : undefined,
    voters: voters.length > 0 ? voters : undefined,
  };
}

function parseObjectFromUnknown(raw: unknown): any | null {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) return null;
  const candidates = [text];
  const withPrefix = text.match(/^[^:]{1,80}:\s*(\{[\s\S]*\})\s*$/);
  if (withPrefix?.[1]) candidates.push(withPrefix[1]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const parsed = parsePossiblySerializedE2EPayload(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  }
  return null;
}

export function parsePollPayload(raw: unknown): PollPayloadV1 | null {
  const source = parseObjectFromUnknown(raw);
  const nested =
    source?.poll ??
    source?.encuesta ??
    source?.pollPayload ??
    source?.encuestaPayload ??
    null;
  const fromContenido = parseObjectFromUnknown(source?.contenido);
  const candidate = nested || fromContenido || source;
  if (!candidate || typeof candidate !== 'object') return null;

  const kind = String(
    candidate?.type ?? candidate?.pollType ?? candidate?.kind ?? ''
  )
    .trim()
    .toUpperCase();
  const question = String(
    candidate?.question ?? candidate?.pregunta ?? candidate?.title ?? ''
  ).trim();
  const optionsRaw = Array.isArray(candidate?.options)
    ? candidate.options
    : Array.isArray(candidate?.opciones)
    ? candidate.opciones
    : [];
  const options = optionsRaw
    .map((opt: any, index: number) => normalizePollOption(opt, index))
    .filter((opt: PollOptionPayload | null): opt is PollOptionPayload => !!opt);

  if ((kind && kind !== 'POLL_V1') || !question || options.length < 2) {
    return null;
  }

  const totalByCount = options.reduce(
    (acc: number, option: PollOptionPayload) => acc + option.voteCount,
    0
  );
  const totalVotes = Math.max(
    toPositiveInt(candidate?.totalVotes ?? candidate?.votosTotales),
    totalByCount
  );

  const createdBy = Number(candidate?.createdBy ?? candidate?.creadoPor ?? 0);
  const createdBySafe =
    Number.isFinite(createdBy) && createdBy > 0 ? Math.round(createdBy) : undefined;
  const createdAt = String(candidate?.createdAt ?? candidate?.creadoEn ?? '').trim();
  const pollIdRaw = candidate?.pollId ?? candidate?.id ?? candidate?.poll_id;
  const pollIdText = String(pollIdRaw ?? '').trim();
  const pollIdNumber = Number(pollIdRaw);
  const pollId =
    pollIdText.length > 0
      ? Number.isFinite(pollIdNumber) && pollIdNumber > 0
        ? Math.round(pollIdNumber)
        : pollIdText
      : undefined;

  return {
    type: 'POLL_V1',
    pollId,
    question,
    allowMultiple: normalizeBooleanLike(
      candidate?.allowMultiple ?? candidate?.permiteMultiples
    ),
    options,
    totalVotes,
    statusText: String(
      candidate?.statusText ?? candidate?.instruction ?? candidate?.instruccion ?? ''
    ).trim() || undefined,
    createdAt: createdAt || undefined,
    createdBy: createdBySafe,
  };
}

export function isPollMessageLike(mensaje: any): boolean {
  const tipo = String(mensaje?.tipo || '').trim().toUpperCase();
  if (tipo === 'POLL') return true;
  return !!parsePollPayload(mensaje);
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

    payload = normalizeE2EPayloadShape(payload);

    const payloadTypeNormalized = String(payload?.type || '')
      .trim()
      .toUpperCase();
    const decryptAsE2E =
      payloadTypeNormalized === 'E2E' ||
      payloadTypeNormalized === 'E2E_GROUP' ||
      hasE2EEnvelopeShape(payload);

    if (decryptAsE2E) {
      const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
      const isSender = String(emisorId) === String(usuarioActualId);
      const recMap =
        (payloadTypeNormalized === 'E2E_GROUP' || payload?.forReceptores) &&
        payload?.forReceptores
          ? payload.forReceptores
          : {};
      const recKeys = Object.keys(recMap || {});

      e2eLog('log', 'decrypt-start', debugContext, {
          payloadType: payload?.type,
          payloadTypeNormalized,
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
      let myPrivKeySha1: CryptoKey | null = null;
      const candidateEnvelopes = buildE2EEnvelopeCandidates(
        payload,
        usuarioActualId,
        isSender
      );

      if (candidateEnvelopes.length === 0) {
        e2eLog('warn', 'decrypt-no-aes-envelope-for-user', debugContext, {
          payloadType: payload?.type,
          hasForEmisor: typeof payload?.forEmisor === 'string',
          hasForReceptor: typeof payload?.forReceptor === 'string',
          forReceptoresKeys: recKeys,
        });
        return '[Mensaje Cifrado - Llave no disponible para este usuario]';
      }
      if (
        typeof payload?.ciphertext !== 'string' ||
        !payload.ciphertext.trim() ||
        typeof payload?.iv !== 'string' ||
        !payload.iv.trim()
      ) {
        e2eLog('warn', 'decrypt-invalid-cipher-shape', debugContext, {
          payloadType: payload?.type,
          hasCiphertext: typeof payload?.ciphertext === 'string',
          hasIv: typeof payload?.iv === 'string',
        });
        return rawString;
      }

      try {
        for (let i = 0; i < candidateEnvelopes.length; i++) {
          const envelope = candidateEnvelopes[i];
          try {
            let aesRawStr = '';
            try {
              aesRawStr = await cryptoService.decryptRSA(envelope, myPrivKey);
            } catch (primaryErr) {
              try {
                if (!myPrivKeySha1) {
                  myPrivKeySha1 = await cryptoService.importPrivateKeyWithHash(
                    privKeyBase64,
                    'SHA-1'
                  );
                }
                aesRawStr = await cryptoService.decryptRSA(envelope, myPrivKeySha1);
              } catch {
                aesRawStr = '';
              }
              if (!aesRawStr) throw primaryErr;
            }
            const aesKeyBase64 = extractAesKeyBase64FromRaw(aesRawStr);
            const aesKey = await cryptoService.importAESKey(aesKeyBase64);
            const plain = await cryptoService.decryptAES(
              payload.ciphertext,
              payload.iv,
              aesKey
            );
            e2eLog('log', 'decrypt-success', debugContext, {
              payloadType: payload?.type,
              envelopeIndex: i,
            });
            return plain;
          } catch (err) {
            e2eLog('log', 'decrypt-envelope-candidate-failed', debugContext, {
              payloadType: payload?.type,
              envelopeIndex: i,
              error: errorToString(err),
            });
            try {
              // Compatibilidad defensiva: algunos backends pueden enviar el envelope
              // ya como AES base64 en claro (sin RSA) por transición.
              const directAes = extractAesKeyBase64FromRaw(envelope);
              const directKey = await cryptoService.importAESKey(directAes);
              const plain = await cryptoService.decryptAES(
                payload.ciphertext,
                payload.iv,
                directKey
              );
              e2eLog('log', 'decrypt-success-direct-aes-envelope', debugContext, {
                payloadType: payload?.type,
                envelopeIndex: i,
              });
              return plain;
            } catch {
              // seguimos con el siguiente candidato
            }
          }
        }
        e2eLog('error', 'decrypt-no-valid-envelope-candidate', debugContext, {
          payloadType: payload?.type,
          tried: candidateEnvelopes.length,
        });
        return '[Error de descifrado E2E]';
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
    payload = normalizeE2EPayloadShape(payload);
    const payloadType = String(payload?.type || '').trim().toUpperCase();
    const decryptAsTextE2E =
      payloadType === 'E2E' ||
      payloadType === 'E2E_GROUP' ||
      hasE2EEnvelopeShape(payload);
    if (
      !decryptAsTextE2E &&
      payloadType !== 'E2E_AUDIO' &&
      payloadType !== 'E2E_GROUP_AUDIO' &&
      payloadType !== 'E2E_IMAGE' &&
      payloadType !== 'E2E_GROUP_IMAGE' &&
      payloadType !== 'E2E_FILE' &&
      payloadType !== 'E2E_GROUP_FILE'
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
      let myPrivKeySha1: CryptoKey | null = null;
      const candidates = buildE2EEnvelopeCandidates(
        payload,
        usuarioActualId,
        false
      );

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;
        try {
          let aesRawStr = '';
          try {
            aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
          } catch (primaryErr) {
            if (!myPrivKeySha1) {
              myPrivKeySha1 = await cryptoService.importPrivateKeyWithHash(
                privKeyBase64,
                'SHA-1'
              );
            }
            aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKeySha1);
            if (!aesRawStr) throw primaryErr;
          }
          const aesKey = await cryptoService.importAESKey(
            extractAesKeyBase64FromRaw(aesRawStr)
          );
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
          try {
            const directKey = await cryptoService.importAESKey(
              extractAesKeyBase64FromRaw(candidate)
            );
            if (payload?.captionCiphertext && payload?.captionIv) {
              const caption = await cryptoService.decryptAES(
                payload.captionCiphertext,
                payload.captionIv,
                directKey
              );
              const cleanCaption = String(caption || '').trim();
              if (cleanCaption) return `Imagen: ${cleanCaption}`;
            }
            return 'Imagen';
          } catch {
            // Intentamos con la siguiente llave disponible.
          }
        }
      }
      return 'Imagen';
    }

    if (payloadType === 'E2E_FILE' || payloadType === 'E2E_GROUP_FILE') {
      const fileName = String(payload?.fileNombre || 'Archivo').trim() || 'Archivo';
      const privKeyBase64 = localStorage.getItem(`privateKey_${usuarioActualId}`);
      if (!privKeyBase64) return `Archivo: ${fileName}`;
      const myPrivKey = await cryptoService.importPrivateKey(privKeyBase64);
      let myPrivKeySha1: CryptoKey | null = null;
      const candidates = buildE2EEnvelopeCandidates(
        payload,
        usuarioActualId,
        false
      );

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;
        try {
          let aesRawStr = '';
          try {
            aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
          } catch (primaryErr) {
            if (!myPrivKeySha1) {
              myPrivKeySha1 = await cryptoService.importPrivateKeyWithHash(
                privKeyBase64,
                'SHA-1'
              );
            }
            aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKeySha1);
            if (!aesRawStr) throw primaryErr;
          }
          const aesKey = await cryptoService.importAESKey(
            extractAesKeyBase64FromRaw(aesRawStr)
          );
          if (payload?.captionCiphertext && payload?.captionIv) {
            const caption = await cryptoService.decryptAES(
              payload.captionCiphertext,
              payload.captionIv,
              aesKey
            );
            const cleanCaption = String(caption || '').trim();
            if (cleanCaption) return `Archivo: ${fileName} - ${cleanCaption}`;
          }
          return `Archivo: ${fileName}`;
        } catch {
          try {
            const directKey = await cryptoService.importAESKey(
              extractAesKeyBase64FromRaw(candidate)
            );
            if (payload?.captionCiphertext && payload?.captionIv) {
              const caption = await cryptoService.decryptAES(
                payload.captionCiphertext,
                payload.captionIv,
                directKey
              );
              const cleanCaption = String(caption || '').trim();
              if (cleanCaption) return `Archivo: ${fileName} - ${cleanCaption}`;
            }
            return `Archivo: ${fileName}`;
          } catch {
            // Intentamos con la siguiente llave disponible.
          }
        }
      }
      return `Archivo: ${fileName}`;
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
    let myPrivKeySha1: CryptoKey | null = null;
    const candidates = buildE2EEnvelopeCandidates(
      payload,
      usuarioActualId,
      false
    );
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue;
      try {
        let aesRawStr = '';
        try {
          aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKey);
        } catch (primaryErr) {
          if (!myPrivKeySha1) {
            myPrivKeySha1 = await cryptoService.importPrivateKeyWithHash(
              privKeyBase64,
              'SHA-1'
            );
          }
          aesRawStr = await cryptoService.decryptRSA(candidate, myPrivKeySha1);
          if (!aesRawStr) throw primaryErr;
        }
        const aesKey = await cryptoService.importAESKey(
          extractAesKeyBase64FromRaw(aesRawStr)
        );
        return await cryptoService.decryptAES(payload.ciphertext, payload.iv, aesKey);
      } catch {
        try {
          const directKey = await cryptoService.importAESKey(
            extractAesKeyBase64FromRaw(candidate)
          );
          return await cryptoService.decryptAES(
            payload.ciphertext,
            payload.iv,
            directKey
          );
        } catch {
          // Intentamos con la siguiente llave disponible.
        }
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
  if (s) {
    return resolveMediaUrl(s, environment.backendBaseUrl) || fallback;
  }
  return resolveMediaUrl(fallback, environment.backendBaseUrl) || fallback;
}

export function isPreviewDeleted(text?: string | null): boolean {
  const t = (text || '').trim().toLowerCase();
  return t === 'mensaje eliminado' || t === 'este mensaje ha sido eliminado';
}

export function formatPreviewText(raw?: string | null): string {
  const t = (raw || '').trim();
  return t.replace(/^mensaje:\s*/i, '');
}

const GROUP_EXPULSION_SYSTEM_EVENTS = new Set([
  'GROUP_MEMBER_EXPELLED',
  'GROUP_MEMBER_KICKED',
  'GROUP_USER_EXPELLED',
  'GROUP_USER_KICKED',
  'GROUP_MEMBER_REMOVED',
  'GROUP_USER_REMOVED',
]);

const GROUP_EXPULSION_TARGET_ID_FIELDS = [
  'targetUserId',
  'targetId',
  'usuarioObjetivoId',
  'miembroId',
  'memberId',
  'removedUserId',
  'removedMemberId',
  'expulsadoId',
  'kickedUserId',
  'affectedUserId',
  'userIdObjetivo',
];

function normalizeSystemEventCode(mensaje: any): string {
  return String(mensaje?.systemEvent || mensaje?.evento || '')
    .trim()
    .toUpperCase();
}

function isGroupExpulsionEventCode(eventCode: string): boolean {
  const normalized = String(eventCode || '').trim().toUpperCase();
  if (!normalized) return false;
  if (GROUP_EXPULSION_SYSTEM_EVENTS.has(normalized)) return true;
  return /^GROUP_/.test(normalized) && /(EXPELLED|KICKED|REMOVED)/.test(normalized);
}

function looksLikeExpulsionNoticeText(text: string): boolean {
  return /^has sido expulsad[oa]\b/i.test(String(text || '').trim());
}

function buildFullName(firstName: unknown, lastName: unknown): string {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  return `${first} ${last}`.trim();
}

function resolveGroupNameForExpulsion(mensaje: any, chatItem: any | undefined): string {
  const fromMessage = pickFirstStringValue(mensaje, [
    'groupName',
    'nombreGrupo',
    'chatNombre',
    'chatNombreGrupo',
  ]);
  if (fromMessage) return fromMessage;
  return String(chatItem?.nombreGrupo || chatItem?.nombre || '').trim();
}

function resolveGroupMemberDisplayNameFromChat(
  chatItem: any | undefined,
  userId: number
): string {
  const normalizedId = Number(userId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return '';
  const users = Array.isArray(chatItem?.usuarios)
    ? chatItem.usuarios
    : Array.isArray(chatItem?.miembros)
    ? chatItem.miembros
    : [];
  const member = users.find((u: any) => Number(u?.id) === normalizedId);
  if (!member) return '';
  const fullName = buildFullName(member?.nombre, member?.apellido);
  if (fullName) return fullName;
  return String(member?.username || member?.nick || member?.name || '').trim();
}

function extractGroupExpulsionTargetUserIdLike(mensaje: any): number {
  for (const field of GROUP_EXPULSION_TARGET_ID_FIELDS) {
    const candidate = Number(mensaje?.[field]);
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  const chatId = Number(mensaje?.chatId || 0);
  const receptorId = Number(mensaje?.receptorId || 0);
  if (
    Number.isFinite(receptorId) &&
    receptorId > 0 &&
    (!Number.isFinite(chatId) || receptorId !== chatId)
  ) {
    return receptorId;
  }
  return 0;
}

function resolveExpulsionActorDisplayName(
  mensaje: any,
  chatItem: any | undefined,
  actorId: number
): string {
  const fromMessage = pickFirstStringValue(mensaje, [
    'expulsorNombreCompleto',
    'actorNombreCompleto',
    'adminNombreCompleto',
    'expulsorNombre',
    'actorNombre',
    'adminNombre',
  ]);
  if (fromMessage) return fromMessage;

  const senderName = buildFullName(mensaje?.emisorNombre, mensaje?.emisorApellido);
  if (senderName) return senderName;

  return resolveGroupMemberDisplayNameFromChat(chatItem, actorId);
}

function resolveExpulsionTargetDisplayName(
  mensaje: any,
  chatItem: any | undefined,
  targetUserId: number
): string {
  const fromMessage = pickFirstStringValue(mensaje, [
    'targetUserName',
    'targetUserFullName',
    'targetNombreCompleto',
    'targetNombre',
    'usuarioObjetivoNombre',
    'memberName',
    'removedUserName',
    'expulsadoNombre',
    'affectedUserName',
  ]);
  if (fromMessage) return fromMessage;

  const nestedTarget = mensaje?.targetUser ?? mensaje?.usuarioObjetivo ?? mensaje?.miembro;
  const nestedName = buildFullName(
    nestedTarget?.nombre || nestedTarget?.firstName,
    nestedTarget?.apellido || nestedTarget?.lastName
  );
  if (nestedName) return nestedName;
  const nestedFallback = String(
    nestedTarget?.nombreCompleto || nestedTarget?.fullName || nestedTarget?.name || ''
  ).trim();
  if (nestedFallback) return nestedFallback;

  return resolveGroupMemberDisplayNameFromChat(chatItem, targetUserId);
}

function resolveExpulsionPerspectiveText(
  mensaje: any,
  perspective: 'actor' | 'target' | 'third'
): string {
  const byPerspective =
    perspective === 'actor'
      ? pickFirstStringValue(mensaje, [
          'textoActor',
          'textoParaActor',
          'actorText',
          'textForActor',
          'previewActor',
        ])
      : perspective === 'target'
      ? pickFirstStringValue(mensaje, [
          'textoExpulsado',
          'textoParaExpulsado',
          'expelledText',
          'textForTarget',
          'previewTarget',
        ])
      : pickFirstStringValue(mensaje, [
          'textoTerceros',
          'textoTercero',
          'textoParaTerceros',
          'thirdPartyText',
          'textForOthers',
          'previewThird',
        ]);
  return byPerspective;
}

function normalizeQuotedDisplayText(text: string): string {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  return raw
    .replace(/"([^"]+)"/g, '$1')
    .replace(/“([^”]+)”/g, '$1')
    .trim();
}

export function buildGroupExpulsionPreview(
  mensaje: any,
  chatItem: any | undefined,
  usuarioActualId: number
): string | null {
  const rawContent = String(mensaje?.contenido || '').trim();
  const parsedContentPayload = parsePossiblySerializedE2EPayload(rawContent);
  const source =
    parsedContentPayload && typeof parsedContentPayload === 'object'
      ? { ...parsedContentPayload, ...mensaje }
      : mensaje;

  const content = String(source?.contenido || '').trim();
  const eventCode = normalizeSystemEventCode(source);
  const isExpulsionEvent = isGroupExpulsionEventCode(eventCode);
  const isExpulsionNotice = looksLikeExpulsionNoticeText(content);
  const hasGroupContext = !!chatItem?.esGrupo || isExpulsionEvent;
  if (!hasGroupContext || (!isExpulsionEvent && !isExpulsionNotice)) return null;

  const myId = Number(usuarioActualId);
  const actorId = Number(source?.emisorId || 0);
  const targetUserId = extractGroupExpulsionTargetUserIdLike(source);
  const groupName = resolveGroupNameForExpulsion(source, chatItem);
  const actorName = resolveExpulsionActorDisplayName(source, chatItem, actorId);
  const targetName = resolveExpulsionTargetDisplayName(
    source,
    chatItem,
    targetUserId
  );

  if (targetUserId > 0 && targetUserId === myId) {
    const targetText = resolveExpulsionPerspectiveText(source, 'target');
    if (targetText) return normalizeQuotedDisplayText(targetText);
    let notice = groupName
      ? `Has sido expulsado de ${groupName}`
      : 'Has sido expulsado del grupo';
    if (actorName && actorId !== myId) {
      notice += ` por ${actorName}`;
    }
    return normalizeQuotedDisplayText(notice);
  }

  if (actorId > 0 && actorId === myId) {
    const actorText = resolveExpulsionPerspectiveText(source, 'actor');
    if (actorText) return normalizeQuotedDisplayText(actorText);
    if (targetName) {
      const message = groupName
        ? `Has expulsado a ${targetName} del grupo ${groupName}`
        : `Has expulsado a ${targetName} del grupo`;
      return normalizeQuotedDisplayText(message);
    }
    const message = groupName
      ? `Has expulsado a un usuario del grupo ${groupName}`
      : 'Has expulsado a un usuario del grupo';
    return normalizeQuotedDisplayText(message);
  }

  const thirdText = resolveExpulsionPerspectiveText(source, 'third');
  if (thirdText) return normalizeQuotedDisplayText(thirdText);

  if (actorName && targetName) {
    const message = groupName
      ? `${actorName} ha expulsado a ${targetName} del grupo ${groupName}`
      : `${actorName} ha expulsado a ${targetName} del grupo`;
    return normalizeQuotedDisplayText(message);
  }
  if (targetName) {
    const message = groupName
      ? `${targetName} ha sido expulsado del grupo ${groupName}`
      : `${targetName} ha sido expulsado del grupo`;
    return normalizeQuotedDisplayText(message);
  }
  if (content) return normalizeQuotedDisplayText(content);
  const fallback = groupName
    ? `Se ha expulsado a un usuario del grupo ${groupName}`
    : 'Se ha expulsado a un usuario del grupo';
  return normalizeQuotedDisplayText(fallback);
}

export function isSystemMessageLike(mensaje: any): boolean {
  if (isTemporalExpiredMessageLike(mensaje)) return false;
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
  const eventCode = normalizeSystemEventCode(mensaje);
  const systemEvents = new Set([
    'GROUP_MEMBER_LEFT',
    'ADMIN_DIRECT_CHAT_EXPIRED',
    ...Array.from(GROUP_EXPULSION_SYSTEM_EVENTS),
  ]);

  return (
    systemTypes.has(tipo) ||
    mensaje?.esSistema === true ||
    systemEvents.has(eventCode) ||
    isGroupExpulsionEventCode(eventCode)
  );
}

export function isTemporalExpiredMessageLike(mensaje: any): boolean {
  if (!mensaje) return false;
  const reason = String(
    mensaje?.motivoEliminacion ?? mensaje?.motivo_eliminacion ?? ''
  )
    .trim()
    .toUpperCase();
  const status = String(
    mensaje?.estadoTemporal ?? mensaje?.estado_temporal ?? ''
  )
    .trim()
    .toUpperCase();
  const eventCode = String(mensaje?.systemEvent ?? mensaje?.evento ?? '')
    .trim()
    .toUpperCase();
  return (
    reason === 'TEMPORAL_EXPIRADO' ||
    status === 'EXPIRADO' ||
    eventCode === 'TEMPORAL_MESSAGE_EXPIRED'
  );
}

function formatTemporalDurationForPlaceholder(secondsRaw: unknown): string {
  const seconds = Number(secondsRaw);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds % (24 * 60 * 60) === 0) {
    const days = Math.round(seconds / (24 * 60 * 60));
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  if (seconds % (60 * 60) === 0) {
    const hours = Math.round(seconds / (60 * 60));
    return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  if (seconds % 60 === 0) {
    const mins = Math.round(seconds / 60);
    return `${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  }
  return `${Math.round(seconds)} segundos`;
}

export function resolveTemporalExpiredPlaceholderText(mensaje: any): string {
  const explicit = String(
    mensaje?.placeholderTexto ??
      mensaje?.placeholder_texto ??
      mensaje?.contenido ??
      ''
  ).trim();
  if (explicit) return explicit;
  const duration = formatTemporalDurationForPlaceholder(
    mensaje?.mensajeTemporalSegundos ?? mensaje?.mensaje_temporal_segundos
  );
  if (duration) {
    return `Se trataba de un mensaje temporal que solo estaba disponible los primeros ${duration}.`;
  }
  return 'Se trataba de un mensaje temporal que ya ha expirado.';
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
function extractFilePayloadFromContent(contenido: unknown): any | null {
  const raw = typeof contenido === 'string' ? contenido : JSON.stringify(contenido ?? '');
  if (!raw || !String(raw).trim()) return null;
  const parsed = parsePossiblySerializedE2EPayload(String(raw));
  if (!parsed || typeof parsed !== 'object') return null;
  const payloadType = String(parsed?.type || '').trim().toUpperCase();
  if (payloadType !== 'E2E_FILE' && payloadType !== 'E2E_GROUP_FILE') return null;
  return parsed;
}

function resolveFilePreviewName(mensaje: any): string {
  const direct = String(mensaje?.fileNombre || '').trim();
  if (direct) return direct;
  const payload = extractFilePayloadFromContent(mensaje?.contenido);
  const fromPayload = String(payload?.fileNombre || '').trim();
  return fromPayload || 'Archivo';
}

function resolveFilePreviewLabel(mensaje: any): string {
  const fileName = resolveFilePreviewName(mensaje);
  const caption = String(mensaje?.contenido ?? '').trim();
  if (caption && !caption.startsWith('{')) return `Archivo: ${fileName} - ${caption}`;
  return `Archivo: ${fileName}`;
}

export function buildPreviewFromMessage(
  mensaje: any,
  chatItem: any | undefined,
  usuarioActualId: number,
  maxLen = 60
): string {
  const expulsionPreview = buildGroupExpulsionPreview(
    mensaje,
    chatItem,
    usuarioActualId
  );
  if (expulsionPreview) {
    return truncate(expulsionPreview, maxLen);
  }

  if (isSystemMessageLike(mensaje)) {
    const systemText = String(mensaje?.contenido ?? '').trim();
    return truncate(systemText || 'Evento del grupo', maxLen);
  }

  if (mensaje?.activo === false) {
    if (isTemporalExpiredMessageLike(mensaje)) {
      return truncate(resolveTemporalExpiredPlaceholderText(mensaje), maxLen);
    }
    return 'Mensaje eliminado';
  }
  const pollPayload = parsePollPayload(mensaje);
  if (pollPayload) {
    const pollText = `Encuesta: ${pollPayload.question}`;
    if (!chatItem) return truncate(pollText, maxLen);
    if (chatItem.esGrupo) {
      const prefijo =
        mensaje.emisorId === usuarioActualId
          ? 'yo: '
          : (mensaje.emisorNombre ||
              getNombrePorId([chatItem], mensaje.emisorId) ||
              'Alguien') + ': ';
      return truncate(prefijo + pollText, maxLen);
    }
    const prefijo = mensaje.emisorId === usuarioActualId ? 'Tú: ' : '';
    return truncate(prefijo + pollText, maxLen);
  }
  const isImage =
    String(mensaje?.tipo || '')
      .trim()
      .toUpperCase() === 'IMAGE' ||
    !!mensaje?.imageUrl ||
    !!mensaje?.imageDataUrl;
  const isFile =
    String(mensaje?.tipo || '')
      .trim()
      .toUpperCase() === 'FILE' ||
    !!mensaje?.fileUrl ||
    !!mensaje?.fileDataUrl ||
    !!extractFilePayloadFromContent(mensaje?.contenido);
  if (isImage) {
    const caption = String(mensaje?.contenido ?? '').trim();
    const label = caption ? `Imagen: ${caption}` : 'Imagen';
    return truncate(label, maxLen);
  }
  if (isFile) {
    return truncate(resolveFilePreviewLabel(mensaje), maxLen);
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

  const expulsionPreview = buildGroupExpulsionPreview(
    mensaje,
    chatItem,
    usuarioActualId
  );

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
  const esArchivo =
    (typeof mensaje?.tipo === 'string' &&
      mensaje.tipo.toUpperCase() === 'FILE') ||
    !!mensaje?.fileUrl ||
    !!mensaje?.fileDataUrl ||
    !!extractFilePayloadFromContent(mensaje?.contenido);

  if (expulsionPreview) {
    preview = expulsionPreview;
  } else if (isSystemMessageLike(mensaje)) {
    preview = String(mensaje?.contenido ?? '').trim() || 'Evento del grupo';
  } else if (mensaje?.activo === false) {
    preview = isTemporalExpiredMessageLike(mensaje)
      ? resolveTemporalExpiredPlaceholderText(mensaje)
      : 'Mensaje eliminado';
  } else if (parsePollPayload(mensaje)) {
    const poll = parsePollPayload(mensaje)!;
    const pollText = `Encuesta: ${poll.question}`;
    if (chatItem && !chatItem.esGrupo) {
      const pref = mensaje?.emisorId === usuarioActualId ? 'Tú: ' : '';
      preview = `${pref}${pollText}`.trim();
    } else {
      const emisorEsActual = Number(mensaje?.emisorId) === Number(usuarioActualId);
      const emisor = String(mensaje?.emisorNombre ?? '').trim();
      const prefix = emisorEsActual ? 'yo: ' : emisor ? `${emisor}: ` : '';
      preview = `${prefix}${pollText}`.trim();
    }
  } else if (chatItem && !chatItem.esGrupo) {
    const pref = mensaje?.emisorId === usuarioActualId ? 'Tú: ' : '';
    if (esAudio) {
      const durMs = Number(mensaje?.audioDuracionMs) || 0;
      const durTxt = durMs ? ` (${formatDuration(durMs)})` : '';
      preview = `${pref}Mensaje de voz${durTxt}`;
    } else if (esImagen) {
      const caption = String(mensaje?.contenido || '').trim();
      preview = `${pref}${caption ? `Imagen: ${caption}` : 'Imagen'}`.trim();
    } else if (esArchivo) {
      preview = `${pref}${resolveFilePreviewLabel(mensaje)}`.trim();
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
    } else if (esArchivo) {
      preview = `${prefix}${resolveFilePreviewLabel(mensaje)}`;
    } else {
      preview = `${prefix}${String(mensaje?.contenido ?? '')}`;
    }
  }

  const fecha = mensaje?.fechaEnvio ?? chatItem?.ultimaFecha ?? null;
  const lastId = mensaje?.id ?? chatItem?.lastPreviewId ?? null;

  return { preview, fecha, lastId };
}

function normalizeLastMessageTipo(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

function toLastMessageTipoDTO(raw: unknown): ChatListItemDTO['ultimaMensajeTipo'] {
  const tipo = normalizeLastMessageTipo(raw);
  if (
    tipo === 'TEXT' ||
    tipo === 'AUDIO' ||
    tipo === 'IMAGE' ||
    tipo === 'VIDEO' ||
    tipo === 'FILE' ||
    tipo === 'SYSTEM' ||
    tipo === 'POLL'
  ) {
    return tipo;
  }
  return null;
}

export function parseChatListRecencyId(
  item: ChatListItemDTO | null | undefined
): number {
  const id = Number(item?.ultimaMensajeId);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function parseChatListRecencyDate(
  item: ChatListItemDTO | null | undefined
): number {
  const ts = Date.parse(String(item?.ultimaFecha || ''));
  return Number.isFinite(ts) ? ts : 0;
}

export function isIncomingChatItemNewer(
  incoming: ChatListItemDTO,
  existing: ChatListItemDTO
): boolean {
  const incomingMsgId = parseChatListRecencyId(incoming);
  const existingMsgId = parseChatListRecencyId(existing);
  if (incomingMsgId !== existingMsgId) return incomingMsgId > existingMsgId;

  const incomingTs = parseChatListRecencyDate(incoming);
  const existingTs = parseChatListRecencyDate(existing);
  if (incomingTs !== existingTs) return incomingTs > existingTs;

  return false;
}

export function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const t = String(value ?? '').trim();
    if (t) return t;
  }
  return null;
}

export function mergeChatListItemForDisplay(
  preferred: ChatListItemDTO,
  fallback: ChatListItemDTO
): ChatListItemDTO {
  return {
    ...fallback,
    ...preferred,
    receptor: preferred.receptor ?? fallback.receptor,
    usuarios:
      Array.isArray(preferred.usuarios) && preferred.usuarios.length > 0
        ? preferred.usuarios
        : fallback.usuarios,
    miembros:
      Array.isArray(preferred.miembros) && preferred.miembros.length > 0
        ? preferred.miembros
        : fallback.miembros,
    ultimaMensaje: firstNonEmptyString(
      preferred.ultimaMensaje,
      fallback.ultimaMensaje
    ),
    ultimaMensajeRaw: firstNonEmptyString(
      preferred.ultimaMensajeRaw,
      fallback.ultimaMensajeRaw
    ),
    ultimaMensajeImageUrl: firstNonEmptyString(
      preferred.ultimaMensajeImageUrl,
      fallback.ultimaMensajeImageUrl
    ),
    ultimaMensajeImageMime: firstNonEmptyString(
      preferred.ultimaMensajeImageMime,
      fallback.ultimaMensajeImageMime
    ),
    ultimaMensajeImageNombre: firstNonEmptyString(
      preferred.ultimaMensajeImageNombre,
      fallback.ultimaMensajeImageNombre
    ),
    ultimaMensajeAudioUrl: firstNonEmptyString(
      preferred.ultimaMensajeAudioUrl,
      fallback.ultimaMensajeAudioUrl
    ),
    ultimaMensajeAudioMime: firstNonEmptyString(
      preferred.ultimaMensajeAudioMime,
      fallback.ultimaMensajeAudioMime
    ),
    ultimaMensajeAudioDuracionMs:
      Number.isFinite(Number(preferred.ultimaMensajeAudioDuracionMs)) &&
      Number(preferred.ultimaMensajeAudioDuracionMs) > 0
        ? Number(preferred.ultimaMensajeAudioDuracionMs)
        : Number.isFinite(Number(fallback.ultimaMensajeAudioDuracionMs)) &&
          Number(fallback.ultimaMensajeAudioDuracionMs) > 0
        ? Number(fallback.ultimaMensajeAudioDuracionMs)
        : null,
    ultimaMensajeFileUrl: firstNonEmptyString(
      preferred.ultimaMensajeFileUrl,
      fallback.ultimaMensajeFileUrl
    ),
    ultimaMensajeFileMime: firstNonEmptyString(
      preferred.ultimaMensajeFileMime,
      fallback.ultimaMensajeFileMime
    ),
    ultimaMensajeFileNombre: firstNonEmptyString(
      preferred.ultimaMensajeFileNombre,
      fallback.ultimaMensajeFileNombre
    ),
    ultimaMensajeFileSizeBytes:
      Number.isFinite(Number(preferred.ultimaMensajeFileSizeBytes)) &&
      Number(preferred.ultimaMensajeFileSizeBytes) >= 0
        ? Number(preferred.ultimaMensajeFileSizeBytes)
        : Number.isFinite(Number(fallback.ultimaMensajeFileSizeBytes)) &&
          Number(fallback.ultimaMensajeFileSizeBytes) >= 0
        ? Number(fallback.ultimaMensajeFileSizeBytes)
        : null,
    ultimaMensajeTipo:
      toLastMessageTipoDTO(preferred.ultimaMensajeTipo) ||
      toLastMessageTipoDTO(fallback.ultimaMensajeTipo) ||
      null,
    ultimaMensajeEmisorId:
      Number.isFinite(Number(preferred.ultimaMensajeEmisorId)) &&
      Number(preferred.ultimaMensajeEmisorId) > 0
        ? Number(preferred.ultimaMensajeEmisorId)
        : Number.isFinite(Number(fallback.ultimaMensajeEmisorId)) &&
          Number(fallback.ultimaMensajeEmisorId) > 0
        ? Number(fallback.ultimaMensajeEmisorId)
        : null,
    ultimaMensajeId:
      parseChatListRecencyId(preferred) ||
      parseChatListRecencyId(fallback) ||
      null,
    ultimaFecha: firstNonEmptyString(preferred.ultimaFecha, fallback.ultimaFecha),
  };
}

export function dedupeChatListItemsById(items: ChatListItemDTO[]): ChatListItemDTO[] {
  const map = new Map<number, ChatListItemDTO>();
  for (const item of items || []) {
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
      continue;
    }

    const incomingNewer = isIncomingChatItemNewer(item, existing);
    const preferred = incomingNewer ? item : existing;
    const fallback = incomingNewer ? existing : item;
    map.set(id, mergeChatListItemForDisplay(preferred, fallback));
  }
  return Array.from(map.values());
}

export interface ConversationHistoryState<TMessage = MensajeDTO> {
  messages: TMessage[];
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  initialized: boolean;
}

export function buildConversationHistoryKey(chatId: number, esGrupo: boolean): string {
  return `${esGrupo ? 'G' : 'I'}:${Number(chatId)}`;
}

export function createInitialHistoryState<TMessage = MensajeDTO>(): ConversationHistoryState<TMessage> {
  return {
    messages: [],
    page: 0,
    hasMore: true,
    loadingMore: false,
    initialized: false,
  };
}

export function mergeMessagesById<T extends { id?: number | null }>(
  existing: T[],
  incoming: T[],
  mode: 'replace' | 'append' | 'prepend'
): T[] {
  const base =
    mode === 'replace'
      ? [...incoming]
      : mode === 'prepend'
      ? [...incoming, ...existing]
      : [...existing, ...incoming];

  const merged: T[] = [];
  const indexById = new Map<number, number>();

  for (const message of base) {
    const id = Number(message?.id);
    if (Number.isFinite(id) && id > 0) {
      const idx = indexById.get(id);
      if (idx != null) {
        merged[idx] = { ...merged[idx], ...message };
        continue;
      }
      indexById.set(id, merged.length);
    }
    merged.push(message);
  }

  return merged;
}

export function getMensajeFechaSafe(m: MensajeDTO): Date | null {
  const raw = (m as any)?.fechaEnvio || (m as any)?.fecha || (m as any)?.createdAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return getDayKey(a) === getDayKey(b);
}

export function shouldShowDateSeparatorForMessages(
  messages: MensajeDTO[],
  index: number
): boolean {
  const current = getMensajeFechaSafe(messages[index]);
  if (!current) return false;

  if (index === 0) return true;
  const previous = getMensajeFechaSafe(messages[index - 1]);
  if (!previous) return true;

  return !isSameDay(current, previous);
}

export function getDateSeparatorLabelForMessage(
  message: MensajeDTO,
  now = new Date()
): string {
  const current = getMensajeFechaSafe(message);
  if (!current) return '';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(current, now)) return 'Hoy';
  if (isSameDay(current, yesterday)) return 'Ayer';
  if (current.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(current);
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(current);
}

export function formatMensajeHoraFromMessage(message: MensajeDTO): string {
  const d = getMensajeFechaSafe(message);
  if (!d || Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function normalizeSearchText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function compareFechaDesc(a: any, b: any): number {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return tb - ta;
}

export function formatAttachmentSize(bytes: number): string {
  const size = Number(bytes || 0);
  if (size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
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
