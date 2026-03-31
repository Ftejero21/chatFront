package com.chat.chat.DTO;

public class EsMiembroDTO {
    private boolean esMiembro;
    private boolean groupDeleted;

    public EsMiembroDTO() {}
    public EsMiembroDTO(boolean esMiembro, boolean groupDeleted) {
        this.esMiembro = esMiembro;
        this.groupDeleted = groupDeleted;
    }

    public boolean isEsMiembro() { return esMiembro; }
    public void setEsMiembro(boolean esMiembro) { this.esMiembro = esMiembro; }

    public boolean isGroupDeleted() { return groupDeleted; }
    public void setGroupDeleted(boolean groupDeleted) { this.groupDeleted = groupDeleted; }
}