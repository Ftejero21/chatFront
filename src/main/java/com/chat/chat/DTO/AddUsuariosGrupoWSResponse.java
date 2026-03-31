package com.chat.chat.DTO;

import java.util.List;

public class AddUsuariosGrupoWSResponse {
    private Long groupId;
    private int totalSolicitados;
    private int yaMiembros;
    private int yaInvitadosPendientes;
    private int invitadosCreados;
    private List<GroupInviteWS> invitaciones; // reutilizamos tu WS payload

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public int getTotalSolicitados() { return totalSolicitados; }
    public void setTotalSolicitados(int totalSolicitados) { this.totalSolicitados = totalSolicitados; }

    public int getYaMiembros() { return yaMiembros; }
    public void setYaMiembros(int yaMiembros) { this.yaMiembros = yaMiembros; }

    public int getYaInvitadosPendientes() { return yaInvitadosPendientes; }
    public void setYaInvitadosPendientes(int yaInvitadosPendientes) { this.yaInvitadosPendientes = yaInvitadosPendientes; }

    public int getInvitadosCreados() { return invitadosCreados; }
    public void setInvitadosCreados(int invitadosCreados) { this.invitadosCreados = invitadosCreados; }

    public List<GroupInviteWS> getInvitaciones() { return invitaciones; }
    public void setInvitaciones(List<GroupInviteWS> invitaciones) { this.invitaciones = invitaciones; }
}
