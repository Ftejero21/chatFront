package com.chat.chat.Entity;

import com.chat.chat.Utils.MessageType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "mensajes",
        indexes = {
                @Index(name = "idx_mensajes_temporal_expira_en", columnList = "mensaje_temporal,expira_en")
        }
)
public class MensajeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "emisor_id")
    private UsuarioEntity emisor;

    @ManyToOne
    @JoinColumn(name = "receptor_id")
    private UsuarioEntity receptor;

    @ManyToOne
    @JoinColumn(name = "chat_id")
    private ChatEntity chat;

    @Enumerated(EnumType.STRING)
    private MessageType tipo = MessageType.TEXT;

    @Column(name = "media_url")
    private String mediaUrl;

    @Column(name = "media_mime")
    private String mediaMime;

    @Column(name = "media_duracion_ms")
    private Integer mediaDuracionMs;

    @Column(name = "media_size_bytes")
    private Long mediaSizeBytes;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String contenido;

    private LocalDateTime fechaEnvio;

    @Column(nullable = false)
    private boolean activo = true;

    @Column(nullable = false)
    private boolean reenviado = false;

    @Column(nullable = false)
    private boolean leido = false;

    @Column(nullable = false)
    private boolean editado = false;

    @Column(name = "fecha_edicion")
    private LocalDateTime fechaEdicion;

    @Column(name = "mensaje_original_id")
    private Long mensajeOriginalId;

    @Column(name = "reply_to_message_id")
    private Long replyToMessageId;

    @Column(name = "reply_snippet", length = 255)
    private String replySnippet;

    @Column(name = "reply_author_name", length = 120)
    private String replyAuthorName;

    @Column(name = "mensaje_temporal", nullable = false)
    private boolean mensajeTemporal = false;

    @Column(name = "mensaje_temporal_segundos")
    private Long mensajeTemporalSegundos;

    @Column(name = "expira_en")
    private LocalDateTime expiraEn;

    @Column(name = "motivo_eliminacion", length = 80)
    private String motivoEliminacion;

    @Column(name = "placeholder_texto", length = 500)
    private String placeholderTexto;

    @Column(name = "fecha_eliminacion")
    private LocalDateTime fechaEliminacion;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UsuarioEntity getEmisor() {
        return emisor;
    }

    public void setEmisor(UsuarioEntity emisor) {
        this.emisor = emisor;
    }

    public UsuarioEntity getReceptor() {
        return receptor;
    }

    public void setReceptor(UsuarioEntity receptor) {
        this.receptor = receptor;
    }

    public ChatEntity getChat() {
        return chat;
    }

    public void setChat(ChatEntity chat) {
        this.chat = chat;
    }

    public MessageType getTipo() {
        return tipo;
    }

    public void setTipo(MessageType tipo) {
        this.tipo = tipo;
    }

    public String getMediaUrl() {
        return mediaUrl;
    }

    public void setMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }

    public String getMediaMime() {
        return mediaMime;
    }

    public void setMediaMime(String mediaMime) {
        this.mediaMime = mediaMime;
    }

    public Integer getMediaDuracionMs() {
        return mediaDuracionMs;
    }

    public void setMediaDuracionMs(Integer mediaDuracionMs) {
        this.mediaDuracionMs = mediaDuracionMs;
    }

    public Long getMediaSizeBytes() {
        return mediaSizeBytes;
    }

    public void setMediaSizeBytes(Long mediaSizeBytes) {
        this.mediaSizeBytes = mediaSizeBytes;
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

    public boolean isReenviado() {
        return reenviado;
    }

    public void setReenviado(boolean reenviado) {
        this.reenviado = reenviado;
    }

    public boolean isLeido() {
        return leido;
    }

    public void setLeido(boolean leido) {
        this.leido = leido;
    }

    public boolean isEditado() {
        return editado;
    }

    public void setEditado(boolean editado) {
        this.editado = editado;
    }

    public LocalDateTime getFechaEdicion() {
        return fechaEdicion;
    }

    public void setFechaEdicion(LocalDateTime fechaEdicion) {
        this.fechaEdicion = fechaEdicion;
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

    public boolean isMensajeTemporal() {
        return mensajeTemporal;
    }

    public void setMensajeTemporal(boolean mensajeTemporal) {
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
}
