export interface BlockedUserDTO {
  userId: number;
  source?: string | null;
}

export interface UsuarioDTO {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  activo?: boolean;
  foto?:string;
  publicKey?: string;
  hasPublicKey?: boolean;
  roles?: string[];
  bloqueadosIds?: number[];
  bloqueados?: BlockedUserDTO[];
  meHanBloqueadoIds?: number[];
}
