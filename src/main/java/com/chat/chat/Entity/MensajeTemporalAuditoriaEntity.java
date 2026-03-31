package com.chat.chat.Entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "mensajes_temporales_auditoria")
public class MensajeTemporalAuditoriaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "mensaje_id", nullable = false, unique = true)
    private Long mensajeId;

    @Column(name = "chat_id")
    private Long chatId;

    @Lob
    @Column(name = "contenido_original", columnDefinition = "TEXT")
    private String contenidoOriginal;

    @Column(name = "tipo_original", length = 30)
    private String tipoOriginal;

    @Column(name = "media_url_original")
    private String mediaUrlOriginal;

    @Column(name = "audio_url_original")
    private String audioUrlOriginal;

    @Column(name = "image_url_original")
    private String imageUrlOriginal;

    @Column(name = "file_url_original")
    private String fileUrlOriginal;

    @Column(name = "media_mime_original")
    private String mediaMimeOriginal;

    @Column(name = "media_duracion_ms_original")
    private Integer mediaDuracionMsOriginal;

    @Column(name = "reenviado", nullable = false)
    private boolean reenviado;

    @Column(name = "mensaje_original_id")
    private Long mensajeOriginalId;

    @Column(name = "reply_to_message_id")
    private Long replyToMessageId;

    @Column(name = "reply_snippet", length = 255)
    private String replySnippet;

    @Column(name = "reply_author_name", length = 120)
    private String replyAuthorName;

    @Column(name = "fecha_envio_original")
    private LocalDateTime fechaEnvioOriginal;

    @Column(name = "expira_en_original")
    private LocalDateTime expiraEnOriginal;

    @Column(name = "estado_temporal_original", length = 20)
    private String estadoTemporalOriginal;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public String getContenidoOriginal() {
        return contenidoOriginal;
    }

    public void setContenidoOriginal(String contenidoOriginal) {
        this.contenidoOriginal = contenidoOriginal;
    }

    public String getTipoOriginal() {
        return tipoOriginal;
    }

    public void setTipoOriginal(String tipoOriginal) {
        this.tipoOriginal = tipoOriginal;
    }

    public String getMediaUrlOriginal() {
        return mediaUrlOriginal;
    }

    public void setMediaUrlOriginal(String mediaUrlOriginal) {
        this.mediaUrlOriginal = mediaUrlOriginal;
    }

    public String getAudioUrlOriginal() {
        return audioUrlOriginal;
    }

    public void setAudioUrlOriginal(String audioUrlOriginal) {
        this.audioUrlOriginal = audioUrlOriginal;
    }

    public String getImageUrlOriginal() {
        return imageUrlOriginal;
    }

    public void setImageUrlOriginal(String imageUrlOriginal) {
        this.imageUrlOriginal = imageUrlOriginal;
    }

    public String getFileUrlOriginal() {
        return fileUrlOriginal;
    }

    public void setFileUrlOriginal(String fileUrlOriginal) {
        this.fileUrlOriginal = fileUrlOriginal;
    }

    public String getMediaMimeOriginal() {
        return mediaMimeOriginal;
    }

    public void setMediaMimeOriginal(String mediaMimeOriginal) {
        this.mediaMimeOriginal = mediaMimeOriginal;
    }

    public Integer getMediaDuracionMsOriginal() {
        return mediaDuracionMsOriginal;
    }

    public void setMediaDuracionMsOriginal(Integer mediaDuracionMsOriginal) {
        this.mediaDuracionMsOriginal = mediaDuracionMsOriginal;
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

    public LocalDateTime getFechaEnvioOriginal() {
        return fechaEnvioOriginal;
    }

    public void setFechaEnvioOriginal(LocalDateTime fechaEnvioOriginal) {
        this.fechaEnvioOriginal = fechaEnvioOriginal;
    }

    public LocalDateTime getExpiraEnOriginal() {
        return expiraEnOriginal;
    }

    public void setExpiraEnOriginal(LocalDateTime expiraEnOriginal) {
        this.expiraEnOriginal = expiraEnOriginal;
    }

    public String getEstadoTemporalOriginal() {
        return estadoTemporalOriginal;
    }

    public void setEstadoTemporalOriginal(String estadoTemporalOriginal) {
        this.estadoTemporalOriginal = estadoTemporalOriginal;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
