export interface BlockedUserDTO {
  userId: number;
  source?: string | null;
}

export interface UsuarioDTO {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  dni?: string;
  documento?: string;
  telefono?: string;
  phone?: string;
  fechaNacimiento?: string;
  fecha_nacimiento?: string;
  birthDate?: string;
  genero?: string;
  gender?: string;
  direccion?: string;
  address?: string;
  nacionalidad?: string;
  nationality?: string;
  ocupacion?: string;
  profesion?: string;
  instagram?: string;
  instagramHandle?: string;
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
