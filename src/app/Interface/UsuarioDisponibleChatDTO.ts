export interface UsuarioDisponibleChat {
  id: number;
  nombre: string;
  apellido?: string | null;
  nombreCompleto: string;
  fotoPerfil?: string | null;
  ultimoMensaje?: string | null;
  ultimoMensajeTipo?: string | null;
  ultimaFecha?: string | null;
  ultimaFechaRaw?: string | null;
  ultimoMensajeId?: number | null;
  ultimoMensajeEmisorId?: number | null;
  chatId?: number | null;
  estado?: string | null;
  tieneConversacion: boolean;
  mensajesNoLeidos?: number | null;
  /** Runtime: texto ya descifrado para mostrar en UI */
  __previewDecrypted?: string | null;
}

export interface UsuariosDisponiblesChatResponse {
  usuariosConConversacion: UsuarioDisponibleChat[];
  usuariosSinConversacion: UsuarioDisponibleChat[];
}
