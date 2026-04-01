import { UsuarioDTO } from "./UsuarioDTO";

;

export interface ChatGrupalDTO {
  id?: number;
  nombreGrupo: string;
  idCreador:number
  descripcion?: string;
  visibilidad?: 'PUBLICO' | 'PRIVADO';
  fotoGrupo?: string;
  usuarios: UsuarioDTO[];
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
