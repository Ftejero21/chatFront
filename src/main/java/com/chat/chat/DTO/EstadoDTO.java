package com.chat.chat.DTO;

public class EstadoDTO {
    private Long usuarioId;
    private String estado; // "Ausente", "Conectado", "Desconectado"

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }
}
