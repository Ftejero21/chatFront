import { UsuarioDTO } from "./UsuarioDTO";

;

export interface ChatGrupalDTO {
  id?: number;
  nombreGrupo: string;
  idCreador:number
  usuarios: UsuarioDTO[];
}
