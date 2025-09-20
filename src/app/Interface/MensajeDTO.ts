export interface MensajeDTO {
  id?: number;
  contenido: string;
  fechaEnvio?: string;
  emisorId: number;
  receptorId: number;
  activo?: boolean;
  leido?:boolean
  chatId?:number
  emisorNombre?:string | undefined;
  emisorApellido?:string | undefined;
  emisorFoto?:string
  tipo?: 'TEXT' | 'AUDIO';
  audioDataUrl?: string | null;       // para enviar como dataURL
  audioUrl?: string | null;           // si el back devuelve url pública
  audioMime?: string | null;          // p.ej. "audio/webm"
  audioDuracionMs?: number | null;

}
