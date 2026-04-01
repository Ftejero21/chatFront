package com.chat.chat.DTO;

public class EscribiendoDTO {
    private Long emisorId;
    private Long receptorId;
    private boolean escribiendo;

    public Long getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(Long emisorId) {
        this.emisorId = emisorId;
    }

    public Long getReceptorId() {
        return receptorId;
    }

    public void setReceptorId(Long receptorId) {
        this.receptorId = receptorId;
    }

    public boolean isEscribiendo() {
        return escribiendo;
    }

    public void setEscribiendo(boolean escribiendo) {
        this.escribiendo = escribiendo;
    }
}