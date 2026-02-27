export type GroupRole = 'ADMIN' | 'MIEMBRO';

export interface GroupMemberDTO {
  id: number;
  nombre: string;
  apellido?: string;
  foto?: string | null;
  rolGrupo: GroupRole;
  estado?: string | null;
}

export interface GroupDetailDTO {
  id: number;
  nombreGrupo: string;
  fotoGrupo?: string | null;
  descripcion?: string | null;
  visibilidad?: 'PUBLICO' | 'PRIVADO' | string;
  fechaCreacion?: string | null;
  idCreador?: number | null;
  nombreCreador?: string | null;
  mediaCount?: number;
  filesCount?: number;
  miembros: GroupMemberDTO[];
}
