import { UsuarioDTO } from './UsuarioDTO';

export type LastMessageTipoDTO =
  | 'TEXT'
  | 'AUDIO'
  | 'IMAGE'
  | 'VIDEO'
  | 'FILE'
  | 'SYSTEM';

export interface ChatListItemDTO {
  id: number;
  receptor?: UsuarioDTO | null;
  nombreGrupo?: string | null;
  fotoGrupo?: string | null;
  foto?: string | null;
  usuarios?: UsuarioDTO[] | null;
  miembros?: UsuarioDTO[] | null;
  unreadCount?: number | null;
  ultimaFecha?: string | null;
  ultimaMensaje?: string | null;

  ultimaMensajeId?: number | null;
  ultimaMensajeTipo?: LastMessageTipoDTO | null;
  ultimaMensajeEmisorId?: number | null;
  ultimaMensajeRaw?: string | null;
  ultimaMensajeImageUrl?: string | null;
  ultimaMensajeImageMime?: string | null;
  ultimaMensajeImageNombre?: string | null;
  ultimaMensajeAudioUrl?: string | null;
  ultimaMensajeAudioMime?: string | null;
  ultimaMensajeAudioDuracionMs?: number | null;
}
