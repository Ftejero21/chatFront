package com.chat.chat.DTO;

public class MessagueSalirGrupoDTO {

    private boolean ok;
    private String mensaje;
    private Long groupId;
    private Long userId;
    private boolean groupDeleted; // true si el grupo quedó vacío y se eliminó

    public MessagueSalirGrupoDTO() {}

    public MessagueSalirGrupoDTO(boolean ok, String mensaje, Long groupId, Long userId, boolean groupDeleted) {
        this.ok = ok;
        this.mensaje = mensaje;
        this.groupId = groupId;
        this.userId = userId;
        this.groupDeleted = groupDeleted;
    }

    public boolean isOk() { return ok; }
    public void setOk(boolean ok) { this.ok = ok; }

    public String getMensaje() { return mensaje; }
    public void setMensaje(String mensaje) { this.mensaje = mensaje; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public boolean isGroupDeleted() { return groupDeleted; }
    public void setGroupDeleted(boolean groupDeleted) { this.groupDeleted = groupDeleted; }
}