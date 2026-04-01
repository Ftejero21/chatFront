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
  meHanBloqueadoIds?: number[];
}
