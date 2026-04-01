package com.chat.chat.DTO;

import java.util.List;

public class AddUsuariosGrupoDTO {
    private Long groupId;
    private Long inviterId;          // opcional si lo sacas del token; aquí lo dejo para ser coherente con tu crear
    private List<UsuarioDTO> usuarios;

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public Long getInviterId() { return inviterId; }
    public void setInviterId(Long inviterId) { this.inviterId = inviterId; }

    public List<UsuarioDTO> getUsuarios() { return usuarios; }
    public void setUsuarios(List<UsuarioDTO> usuarios) { this.usuarios = usuarios; }
}
