package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonAlias;

import java.time.LocalDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class MensajeDTO {
    private Long id;
    private Long emisorId;
    private Long receptorId;
    private String contenido;
    private LocalDateTime fechaEnvio;
    private boolean activo;

    private String tipo;             // opcional: usar String o MessageType en el DTO

    private boolean reenviado;
    private Long mensajeOriginalId;

    private Long replyToMessageId;
    private String replySnippet;
    private String replyAuthorName;

    // AUDIO (entrada desde el front)
    private String audioDataUrl;     // data:image/...;base64,...  (pero de audio)
    private String audioUrl;         // si ya viene subido (/uploads/voice/xxx.webm)
    private String audioMime;        // p.ej "audio/webm"
    private Integer audioDuracionMs;
    private String imageUrl;
    private String imageMime;
    private String imageNombre;
    private String fileUrl;
    private String fileMime;
    private String fileNombre;
    private Long fileSizeBytes;
    private String reaccionEmoji;
    private Long reaccionUsuarioId;
    private LocalDateTime reaccionFecha;
    private List<MensajeReaccionResumenDTO> reacciones;

    private boolean leido;
    private boolean editado;
    private Boolean edited;
    private LocalDateTime fechaEdicion;
    private LocalDateTime editedAt;

    private Long chatId;
    private EncuestaDTO poll;
    @JsonAlias("poll_type")
    private String pollType;
    @JsonAlias("content_kind")
    private String contentKind;
    private Boolean mensajeTemporal;
    private Long mensajeTemporalSegundos;
    private LocalDateTime expiraEn;
    private String estadoTemporal;
    private String motivoEliminacion;
    private String placeholderTexto;
    @JsonAlias({"deletedAt", "deleted_at", "fecha_eliminacion"})
    private LocalDateTime fechaEliminacion;
    private String contenidoAuditoria;
    private String audioUrlAuditoria;
    private String imageUrlAuditoria;
    private Boolean tieneOriginalAuditoria;

    private String emisorNombre;
    private String emisorApellido;
    private String emisorNombreCompleto;
    private String emisorFoto;
    private Boolean esSistema;
    private String systemEvent;
    private Long targetUserId;

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

    public String getEmisorNombreCompleto() {
        return emisorNombreCompleto;
    }

    public void setEmisorNombreCompleto(String emisorNombreCompleto) {
        this.emisorNombreCompleto = emisorNombreCompleto;
    }

    public String getEmisorFoto() {
        return emisorFoto;
    }

    public void setEmisorFoto(String emisorFoto) {
        this.emisorFoto = emisorFoto;
    }

    public Boolean getEsSistema() {
        if (esSistema != null) {
            return esSistema;
        }
        return tipo != null && "SYSTEM".equalsIgnoreCase(tipo);
    }

    public void setEsSistema(Boolean esSistema) {
        this.esSistema = esSistema;
    }

    public String getSystemEvent() {
        return systemEvent;
    }

    public void setSystemEvent(String systemEvent) {
        this.systemEvent = systemEvent;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }

    public boolean isReenviado() {
        return reenviado;
    }

    public void setReenviado(boolean reenviado) {
        this.reenviado = reenviado;
    }

    public Long getMensajeOriginalId() {
        return mensajeOriginalId;
    }

    public void setMensajeOriginalId(Long mensajeOriginalId) {
        this.mensajeOriginalId = mensajeOriginalId;
    }

    public Long getReplyToMessageId() {
        return replyToMessageId;
    }

    public void setReplyToMessageId(Long replyToMessageId) {
        this.replyToMessageId = replyToMessageId;
    }

    public String getReplySnippet() {
        return replySnippet;
    }

    public void setReplySnippet(String replySnippet) {
        this.replySnippet = replySnippet;
    }

    public String getReplyAuthorName() {
        return replyAuthorName;
    }

    public void setReplyAuthorName(String replyAuthorName) {
        this.replyAuthorName = replyAuthorName;
    }

    public boolean isLeido() {
        return leido;
    }

    public boolean isEditado() {
        return editado || Boolean.TRUE.equals(edited);
    }

    public void setEditado(boolean editado) {
        this.editado = editado;
        this.edited = editado;
    }

    public Boolean getEdited() {
        return edited == null ? editado : edited;
    }

    public void setEdited(Boolean edited) {
        this.edited = edited;
        if (edited != null) {
            this.editado = edited;
        }
    }

    public LocalDateTime getFechaEdicion() {
        return fechaEdicion;
    }

    public void setFechaEdicion(LocalDateTime fechaEdicion) {
        this.fechaEdicion = fechaEdicion;
        if (fechaEdicion != null && this.editedAt == null) {
            this.editedAt = fechaEdicion;
        }
    }

    public LocalDateTime getEditedAt() {
        return editedAt == null ? fechaEdicion : editedAt;
    }

    public void setEditedAt(LocalDateTime editedAt) {
        this.editedAt = editedAt;
        if (editedAt != null) {
            this.fechaEdicion = editedAt;
        }
    }

    public Long getChatId() {
        return chatId;
    }

    public EncuestaDTO getPoll() {
        return poll;
    }

    public void setPoll(EncuestaDTO poll) {
        this.poll = poll;
    }

    public String getPollType() {
        return pollType;
    }

    public void setPollType(String pollType) {
        this.pollType = pollType;
    }

    public String getContentKind() {
        return contentKind;
    }

    public void setContentKind(String contentKind) {
        this.contentKind = contentKind;
    }

    public Boolean getMensajeTemporal() {
        return mensajeTemporal;
    }

    public void setMensajeTemporal(Boolean mensajeTemporal) {
        this.mensajeTemporal = mensajeTemporal;
    }

    public Long getMensajeTemporalSegundos() {
        return mensajeTemporalSegundos;
    }

    public void setMensajeTemporalSegundos(Long mensajeTemporalSegundos) {
        this.mensajeTemporalSegundos = mensajeTemporalSegundos;
    }

    public LocalDateTime getExpiraEn() {
        return expiraEn;
    }

    public void setExpiraEn(LocalDateTime expiraEn) {
        this.expiraEn = expiraEn;
    }

    public String getEstadoTemporal() {
        return estadoTemporal;
    }

    public void setEstadoTemporal(String estadoTemporal) {
        this.estadoTemporal = estadoTemporal;
    }

    public String getMotivoEliminacion() {
        return motivoEliminacion;
    }

    public void setMotivoEliminacion(String motivoEliminacion) {
        this.motivoEliminacion = motivoEliminacion;
    }

    public String getPlaceholderTexto() {
        return placeholderTexto;
    }

    public void setPlaceholderTexto(String placeholderTexto) {
        this.placeholderTexto = placeholderTexto;
    }

    public LocalDateTime getFechaEliminacion() {
        return fechaEliminacion;
    }

    public void setFechaEliminacion(LocalDateTime fechaEliminacion) {
        this.fechaEliminacion = fechaEliminacion;
    }

    public String getContenidoAuditoria() {
        return contenidoAuditoria;
    }

    public void setContenidoAuditoria(String contenidoAuditoria) {
        this.contenidoAuditoria = contenidoAuditoria;
    }

    public String getAudioUrlAuditoria() {
        return audioUrlAuditoria;
    }

    public void setAudioUrlAuditoria(String audioUrlAuditoria) {
        this.audioUrlAuditoria = audioUrlAuditoria;
    }

    public String getImageUrlAuditoria() {
        return imageUrlAuditoria;
    }

    public void setImageUrlAuditoria(String imageUrlAuditoria) {
        this.imageUrlAuditoria = imageUrlAuditoria;
    }

    public Boolean getTieneOriginalAuditoria() {
        return tieneOriginalAuditoria;
    }

    public void setTieneOriginalAuditoria(Boolean tieneOriginalAuditoria) {
        this.tieneOriginalAuditoria = tieneOriginalAuditoria;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getAudioDataUrl() {
        return audioDataUrl;
    }

    public void setAudioDataUrl(String audioDataUrl) {
        this.audioDataUrl = audioDataUrl;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public String getAudioMime() {
        return audioMime;
    }

    public void setAudioMime(String audioMime) {
        this.audioMime = audioMime;
    }

    public Integer getAudioDuracionMs() {
        return audioDuracionMs;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImageMime() {
        return imageMime;
    }

    public void setImageMime(String imageMime) {
        this.imageMime = imageMime;
    }

    public String getImageNombre() {
        return imageNombre;
    }

    public void setImageNombre(String imageNombre) {
        this.imageNombre = imageNombre;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileMime() {
        return fileMime;
    }

    public void setFileMime(String fileMime) {
        this.fileMime = fileMime;
    }

    public String getFileNombre() {
        return fileNombre;
    }

    public void setFileNombre(String fileNombre) {
        this.fileNombre = fileNombre;
    }

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }


    public void setAudioDuracionMs(Integer audioDuracionMs) {
        this.audioDuracionMs = audioDuracionMs;
    }

    public String getReaccionEmoji() {
        return reaccionEmoji;
    }

    public void setReaccionEmoji(String reaccionEmoji) {
        this.reaccionEmoji = reaccionEmoji;
    }

    public Long getReaccionUsuarioId() {
        return reaccionUsuarioId;
    }

    public void setReaccionUsuarioId(Long reaccionUsuarioId) {
        this.reaccionUsuarioId = reaccionUsuarioId;
    }

    public LocalDateTime getReaccionFecha() {
        return reaccionFecha;
    }

    public void setReaccionFecha(LocalDateTime reaccionFecha) {
        this.reaccionFecha = reaccionFecha;
    }

    public List<MensajeReaccionResumenDTO> getReacciones() {
        return reacciones;
    }

    public void setReacciones(List<MensajeReaccionResumenDTO> reacciones) {
        this.reacciones = reacciones;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public void setLeido(boolean leido) {
        this.leido = leido;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public String getContenido() {
        return contenido;
    }

    public void setContenido(String contenido) {
        this.contenido = contenido;
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
}
