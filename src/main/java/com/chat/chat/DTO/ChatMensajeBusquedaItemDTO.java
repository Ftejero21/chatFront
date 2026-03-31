package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMensajeBusquedaItemDTO {
    private Long id;
    private Long chatId;
    private Long emisorId;
    private String emisorNombre;
    private String emisorApellido;
    private String contenido;
    private String snippet;
    private LocalDateTime fechaEnvio;
    private Integer matchStart;
    private Integer matchEnd;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getEmisorNombre() {
        return emisorNombre;
    }

    public void setEmisorNombre(String emisorNombre) {
        this.emisorNombre = emisorNombre;
    }

    public String getEmisorApellido() {
        return emisorApellido;
    }

    public void setEmisorApellido(String emisorApellido) {
        this.emisorApellido = emisorApellido;
    }

    public String getContenido() {
        return contenido;
    }

    public void setContenido(String contenido) {
        this.contenido = contenido;
    }

    public String getSnippet() {
        return snippet;
    }

    public void setSnippet(String snippet) {
        this.snippet = snippet;
    }

    public LocalDateTime getFechaEnvio() {
        return fechaEnvio;
    }

    public void setFechaEnvio(LocalDateTime fechaEnvio) {
        this.fechaEnvio = fechaEnvio;
    }

    public Integer getMatchStart() {
        return matchStart;
    }

    public void setMatchStart(Integer matchStart) {
        this.matchStart = matchStart;
    }

    public Integer getMatchEnd() {
        return matchEnd;
    }

    public void setMatchEnd(Integer matchEnd) {
        this.matchEnd = matchEnd;
    }
}
