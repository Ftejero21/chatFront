package com.chat.chat.DTO;

public class GroupMemberExpulsionResponseDTO {

    private boolean ok;
    private String mensaje;
    private Long groupId;
    private Long userId;
    private Long expelledById;
    private String expelledByName;

    public GroupMemberExpulsionResponseDTO() {
    }

    public GroupMemberExpulsionResponseDTO(boolean ok,
                                           String mensaje,
                                           Long groupId,
                                           Long userId,
                                           Long expelledById,
                                           String expelledByName) {
        this.ok = ok;
        this.mensaje = mensaje;
        this.groupId = groupId;
        this.userId = userId;
        this.expelledById = expelledById;
        this.expelledByName = expelledByName;
    }

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public String getMensaje() {
        return mensaje;
    }

    public void setMensaje(String mensaje) {
        this.mensaje = mensaje;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getExpelledById() {
        return expelledById;
    }

    public void setExpelledById(Long expelledById) {
        this.expelledById = expelledById;
    }

    public String getExpelledByName() {
        return expelledByName;
    }

    public void setExpelledByName(String expelledByName) {
        this.expelledByName = expelledByName;
    }
}
