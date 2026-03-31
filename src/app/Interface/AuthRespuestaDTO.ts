import { UsuarioDTO } from './UsuarioDTO';

export interface AuthRespuestaDTO {
  token: string;
  usuario: UsuarioDTO;
}
