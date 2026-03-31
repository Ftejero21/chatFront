package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class GroupMediaItemDTO {
    private Long messageId;
    private Long chatId;
    private Long emisorId;
    private String emisorNombreCompleto;
    private String tipo;
    private LocalDateTime fechaEnvio;
    private boolean activo;
    private boolean reenviado;
    private String mime;
    private Long sizeBytes;
    private Integer durMs;
    private String fileName;
    private String mediaUrl;
    private String contenidoRaw;

    public Long getMessageId() {
        return messageId;
    }

    public void setMessageId(Long messageId) {
        this.messageId = messageId;
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

    public String getEmisorNombreCompleto() {
        return emisorNombreCompleto;
    }

    public void setEmisorNombreCompleto(String emisorNombreCompleto) {
        this.emisorNombreCompleto = emisorNombreCompleto;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public LocalDateTime getFechaEnvio() {
        return fechaEnvio;
    }

    public void setFechaEnvio(LocalDateTime fechaEnvio) {
        this.fechaEnvio = fechaEnvio;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public boolean isReenviado() {
        return reenviado;
    }

    public void setReenviado(boolean reenviado) {
        this.reenviado = reenviado;
    }

    public String getMime() {
        return mime;
    }

    public void setMime(String mime) {
        this.mime = mime;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public Integer getDurMs() {
        return durMs;
    }

    public void setDurMs(Integer durMs) {
        this.durMs = durMs;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getMediaUrl() {
        return mediaUrl;
    }

    public void setMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }

    public String getContenidoRaw() {
        return contenidoRaw;
    }

    public void setContenidoRaw(String contenidoRaw) {
        this.contenidoRaw = contenidoRaw;
    }
}
