import { UsuarioDTO } from "./UsuarioDTO";


export interface ChatIndividualDTO {
  id: number;
  usuario1: UsuarioDTO;
  usuario2: UsuarioDTO;
  ultimaFecha?: string | null;
  ultimaMensaje?: string | null;
  ultimaMensajeId?: number | null;
  ultimaMensajeTipo?:
    | 'TEXT'
    | 'AUDIO'
    | 'IMAGE'
    | 'VIDEO'
    | 'FILE'
    | 'SYSTEM'
    | null;
  ultimaMensajeEmisorId?: number | null;
  ultimaMensajeRaw?: string | null;
  ultimaMensajeImageUrl?: string | null;
  ultimaMensajeImageMime?: string | null;
  ultimaMensajeImageNombre?: string | null;
  ultimaMensajeAudioUrl?: string | null;
  ultimaMensajeAudioMime?: string | null;
  ultimaMensajeAudioDuracionMs?: number | null;
}
