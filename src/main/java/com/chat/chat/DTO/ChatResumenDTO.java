package com.chat.chat.DTO;

import java.time.LocalDateTime;

public class ChatResumenDTO {
    private Long id;
    private String tipo;
    private String nombreChat;
    private Integer totalMensajes;
    private String ultimoMensaje;
    private LocalDateTime fechaUltimoMensaje;
    private String ultimoMensajeDescifrado;
    private String ultimoMensajeTexto;
    private String ultimoMensajeEmisorNombre;
    private String ultimoMensajeEmisorApellido;
    private String ultimoMensajeEmisorNombreCompleto;
    private String ultimoMensajePreview;
    private LocalDateTime ultimoMensajeFecha;
    private String ultimoMensajeTipo;
    private Boolean ultimoMensajeTemporal;
    private Long ultimoMensajeTemporalSegundos;
    private LocalDateTime ultimoMensajeExpiraEn;
    private String ultimoMensajeEstadoTemporal;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getNombreChat() {
        return nombreChat;
    }

    public void setNombreChat(String nombreChat) {
        this.nombreChat = nombreChat;
    }

    public Integer getTotalMensajes() {
        return totalMensajes;
    }

    public void setTotalMensajes(Integer totalMensajes) {
        this.totalMensajes = totalMensajes;
    }

    public String getUltimoMensaje() {
        return ultimoMensaje;
    }

    public void setUltimoMensaje(String ultimoMensaje) {
        this.ultimoMensaje = ultimoMensaje;
    }

    public LocalDateTime getFechaUltimoMensaje() {
        return fechaUltimoMensaje;
    }

    public void setFechaUltimoMensaje(LocalDateTime fechaUltimoMensaje) {
        this.fechaUltimoMensaje = fechaUltimoMensaje;
    }

    public String getUltimoMensajeDescifrado() {
        return ultimoMensajeDescifrado;
    }

    public void setUltimoMensajeDescifrado(String ultimoMensajeDescifrado) {
        this.ultimoMensajeDescifrado = ultimoMensajeDescifrado;
    }

    public String getUltimoMensajeTexto() {
        return ultimoMensajeTexto;
    }

    public void setUltimoMensajeTexto(String ultimoMensajeTexto) {
        this.ultimoMensajeTexto = ultimoMensajeTexto;
    }

    public String getUltimoMensajeEmisorNombre() {
        return ultimoMensajeEmisorNombre;
    }

    public void setUltimoMensajeEmisorNombre(String ultimoMensajeEmisorNombre) {
        this.ultimoMensajeEmisorNombre = ultimoMensajeEmisorNombre;
    }

    public String getUltimoMensajeEmisorApellido() {
        return ultimoMensajeEmisorApellido;
    }

    public void setUltimoMensajeEmisorApellido(String ultimoMensajeEmisorApellido) {
        this.ultimoMensajeEmisorApellido = ultimoMensajeEmisorApellido;
    }

    public String getUltimoMensajeEmisorNombreCompleto() {
        return ultimoMensajeEmisorNombreCompleto;
    }

    public void setUltimoMensajeEmisorNombreCompleto(String ultimoMensajeEmisorNombreCompleto) {
        this.ultimoMensajeEmisorNombreCompleto = ultimoMensajeEmisorNombreCompleto;
    }

    public String getUltimoMensajePreview() {
        return ultimoMensajePreview;
    }

    public void setUltimoMensajePreview(String ultimoMensajePreview) {
        this.ultimoMensajePreview = ultimoMensajePreview;
    }

    public LocalDateTime getUltimoMensajeFecha() {
        return ultimoMensajeFecha;
    }

    public void setUltimoMensajeFecha(LocalDateTime ultimoMensajeFecha) {
        this.ultimoMensajeFecha = ultimoMensajeFecha;
    }

    public String getUltimoMensajeTipo() {
        return ultimoMensajeTipo;
    }

    public void setUltimoMensajeTipo(String ultimoMensajeTipo) {
        this.ultimoMensajeTipo = ultimoMensajeTipo;
    }

    public Boolean getUltimoMensajeTemporal() {
        return ultimoMensajeTemporal;
    }

    public void setUltimoMensajeTemporal(Boolean ultimoMensajeTemporal) {
        this.ultimoMensajeTemporal = ultimoMensajeTemporal;
    }

    public Long getUltimoMensajeTemporalSegundos() {
        return ultimoMensajeTemporalSegundos;
    }

    public void setUltimoMensajeTemporalSegundos(Long ultimoMensajeTemporalSegundos) {
        this.ultimoMensajeTemporalSegundos = ultimoMensajeTemporalSegundos;
    }

    public LocalDateTime getUltimoMensajeExpiraEn() {
        return ultimoMensajeExpiraEn;
    }

    public void setUltimoMensajeExpiraEn(LocalDateTime ultimoMensajeExpiraEn) {
        this.ultimoMensajeExpiraEn = ultimoMensajeExpiraEn;
    }

    public String getUltimoMensajeEstadoTemporal() {
        return ultimoMensajeEstadoTemporal;
    }

    public void setUltimoMensajeEstadoTemporal(String ultimoMensajeEstadoTemporal) {
        this.ultimoMensajeEstadoTemporal = ultimoMensajeEstadoTemporal;
    }
}
