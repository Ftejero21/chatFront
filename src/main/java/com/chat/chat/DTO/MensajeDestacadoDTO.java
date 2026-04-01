package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class MensajeDestacadoDTO {
    private Long mensajeId;
    private Long chatId;
    private Long emisorId;
    private String preview;
    private String tipoMensaje;
    private LocalDateTime fechaMensaje;
    private LocalDateTime destacadoEn;
    private String nombreChat;
    private String nombreEmisor;
    private String nombreEmisorCompleto;

    public Long getMensajeId() {
        return mensajeId;
    }

    public void setMensajeId(Long mensajeId) {
        this.mensajeId = mensajeId;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public Long getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(Long emisorId) {
        this.emisorId = emisorId;
    }

    public String getPreview() {
        return preview;
    }

    public void setPreview(String preview) {
        this.preview = preview;
    }

    public String getTipoMensaje() {
        return tipoMensaje;
    }

    public void setTipoMensaje(String tipoMensaje) {
        this.tipoMensaje = tipoMensaje;
    }

    public LocalDateTime getFechaMensaje() {
        return fechaMensaje;
    }

    public void setFechaMensaje(LocalDateTime fechaMensaje) {
        this.fechaMensaje = fechaMensaje;
    }

    public LocalDateTime getDestacadoEn() {
        return destacadoEn;
    }

    public void setDestacadoEn(LocalDateTime destacadoEn) {
        this.destacadoEn = destacadoEn;
    }

    public String getNombreChat() {
        return nombreChat;
    }

    public void setNombreChat(String nombreChat) {
        this.nombreChat = nombreChat;
    }

    public String getNombreEmisor() {
        return nombreEmisor;
    }

    public void setNombreEmisor(String nombreEmisor) {
        this.nombreEmisor = nombreEmisor;
    }

    public String getNombreEmisorCompleto() {
        return nombreEmisorCompleto;
    }

    public void setNombreEmisorCompleto(String nombreEmisorCompleto) {
        this.nombreEmisorCompleto = nombreEmisorCompleto;
    }
}
