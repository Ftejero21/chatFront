export interface UsuarioDTO {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  activo?: boolean;
  foto?:string;
  publicKey?: string;
  roles?: string[];
  bloqueadosIds?: number[];
  meHanBloqueadoIds?: number[];
}
