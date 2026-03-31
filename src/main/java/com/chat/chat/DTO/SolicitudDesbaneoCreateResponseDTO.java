package com.chat.chat.DTO;

public class SolicitudDesbaneoCreateResponseDTO {
    private String mensaje;
    private Long solicitudId;

    public SolicitudDesbaneoCreateResponseDTO() {
    }

    public SolicitudDesbaneoCreateResponseDTO(String mensaje, Long solicitudId) {
        this.mensaje = mensaje;
        this.solicitudId = solicitudId;
    }

    public String getMensaje() {
        return mensaje;
    }

    public void setMensaje(String mensaje) {
        this.mensaje = mensaje;
    }

    public Long getSolicitudId() {
        return solicitudId;
    }

    public void setSolicitudId(Long solicitudId) {
        this.solicitudId = solicitudId;
    }
}
