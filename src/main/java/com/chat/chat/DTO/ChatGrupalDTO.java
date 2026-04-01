package com.chat.chat.DTO;

import java.time.LocalDateTime;
import java.util.List;

public class ChatGrupalDTO {
    private Long id;
    private String nombreGrupo;
    private List<UsuarioDTO> usuarios;

    private Long idCreador;
    private String descripcion;
    private String visibilidad;

    private String fotoGrupo;
    private String ultimaMensaje;
    private Long ultimaMensajeId;
    private String ultimaMensajeTipo;
    private Long ultimaMensajeEmisorId;
    private String ultimaMensajeRaw;
    private String ultimaMensajeImageUrl;
    private String ultimaMensajeImageMime;
    private String ultimaMensajeImageNombre;
    private String ultimaMensajeAudioUrl;
    private String ultimaMensajeAudioMime;
    private Integer ultimaMensajeAudioDuracionMs;
    private String ultimaMensajeFileUrl;
    private String ultimaMensajeFileMime;
    private String ultimaMensajeFileNombre;
    private Long ultimaMensajeFileSizeBytes;
    private LocalDateTime ultimaFecha;
    private Boolean isPinned;
    private LocalDateTime pinnedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombreGrupo() {
        return nombreGrupo;
    }

    public void setNombreGrupo(String nombreGrupo) {
        this.nombreGrupo = nombreGrupo;
    }

    public List<UsuarioDTO> getUsuarios() {
        return usuarios;
    }

    public void setUsuarios(List<UsuarioDTO> usuarios) {
        this.usuarios = usuarios;
    }

    public Long getIdCreador() {
        return idCreador;
    }

    public void setIdCreador(Long idCreador) {
        this.idCreador = idCreador;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getVisibilidad() {
        return visibilidad;
    }

    public void setVisibilidad(String visibilidad) {
        this.visibilidad = visibilidad;
    }

    public String getFotoGrupo() {
        return fotoGrupo;
    }

    public void setFotoGrupo(String fotoGrupo) {
        this.fotoGrupo = fotoGrupo;
    }

    public String getUltimaMensaje() {
        return ultimaMensaje;
    }

    public void setUltimaMensaje(String ultimaMensaje) {
        this.ultimaMensaje = ultimaMensaje;
    }

    public Long getUltimaMensajeId() {
        return ultimaMensajeId;
    }

    public void setUltimaMensajeId(Long ultimaMensajeId) {
        this.ultimaMensajeId = ultimaMensajeId;
    }

    public String getUltimaMensajeTipo() {
        return ultimaMensajeTipo;
    }

    public void setUltimaMensajeTipo(String ultimaMensajeTipo) {
        this.ultimaMensajeTipo = ultimaMensajeTipo;
    }

    public Long getUltimaMensajeEmisorId() {
        return ultimaMensajeEmisorId;
    }

    public void setUltimaMensajeEmisorId(Long ultimaMensajeEmisorId) {
        this.ultimaMensajeEmisorId = ultimaMensajeEmisorId;
    }

    public String getUltimaMensajeRaw() {
        return ultimaMensajeRaw;
    }

    public void setUltimaMensajeRaw(String ultimaMensajeRaw) {
        this.ultimaMensajeRaw = ultimaMensajeRaw;
    }

    public String getUltimaMensajeImageUrl() {
        return ultimaMensajeImageUrl;
    }

    public void setUltimaMensajeImageUrl(String ultimaMensajeImageUrl) {
        this.ultimaMensajeImageUrl = ultimaMensajeImageUrl;
    }

    public String getUltimaMensajeImageMime() {
        return ultimaMensajeImageMime;
    }

    public void setUltimaMensajeImageMime(String ultimaMensajeImageMime) {
        this.ultimaMensajeImageMime = ultimaMensajeImageMime;
    }

    public String getUltimaMensajeImageNombre() {
        return ultimaMensajeImageNombre;
    }

    public void setUltimaMensajeImageNombre(String ultimaMensajeImageNombre) {
        this.ultimaMensajeImageNombre = ultimaMensajeImageNombre;
    }

    public String getUltimaMensajeAudioUrl() {
        return ultimaMensajeAudioUrl;
    }

    public void setUltimaMensajeAudioUrl(String ultimaMensajeAudioUrl) {
        this.ultimaMensajeAudioUrl = ultimaMensajeAudioUrl;
    }

    public String getUltimaMensajeAudioMime() {
        return ultimaMensajeAudioMime;
    }

    public void setUltimaMensajeAudioMime(String ultimaMensajeAudioMime) {
        this.ultimaMensajeAudioMime = ultimaMensajeAudioMime;
    }

    public Integer getUltimaMensajeAudioDuracionMs() {
        return ultimaMensajeAudioDuracionMs;
    }

    public void setUltimaMensajeAudioDuracionMs(Integer ultimaMensajeAudioDuracionMs) {
        this.ultimaMensajeAudioDuracionMs = ultimaMensajeAudioDuracionMs;
    }

    public String getUltimaMensajeFileUrl() {
        return ultimaMensajeFileUrl;
    }

    public void setUltimaMensajeFileUrl(String ultimaMensajeFileUrl) {
        this.ultimaMensajeFileUrl = ultimaMensajeFileUrl;
    }

    public String getUltimaMensajeFileMime() {
        return ultimaMensajeFileMime;
    }

    public void setUltimaMensajeFileMime(String ultimaMensajeFileMime) {
        this.ultimaMensajeFileMime = ultimaMensajeFileMime;
    }

    public String getUltimaMensajeFileNombre() {
        return ultimaMensajeFileNombre;
    }

    public void setUltimaMensajeFileNombre(String ultimaMensajeFileNombre) {
        this.ultimaMensajeFileNombre = ultimaMensajeFileNombre;
    }

    public Long getUltimaMensajeFileSizeBytes() {
        return ultimaMensajeFileSizeBytes;
    }

    public void setUltimaMensajeFileSizeBytes(Long ultimaMensajeFileSizeBytes) {
        this.ultimaMensajeFileSizeBytes = ultimaMensajeFileSizeBytes;
    }

    public LocalDateTime getUltimaFecha() {
        return ultimaFecha;
    }

    public void setUltimaFecha(LocalDateTime ultimaFecha) {
        this.ultimaFecha = ultimaFecha;
    }

    public Boolean getIsPinned() {
        return isPinned;
    }

    public void setIsPinned(Boolean isPinned) {
        this.isPinned = isPinned;
    }

    public LocalDateTime getPinnedAt() {
        return pinnedAt;
    }

    public void setPinnedAt(LocalDateTime pinnedAt) {
        this.pinnedAt = pinnedAt;
    }
}
