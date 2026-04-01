package com.chat.chat.Entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "poll",
        indexes = {
                @Index(name = "idx_poll_mensaje", columnList = "mensaje_id"),
                @Index(name = "idx_poll_chat", columnList = "chat_id"),
                @Index(name = "idx_poll_created_by", columnList = "created_by")
        }
)
public class EncuestaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mensaje_id", nullable = false, unique = true)
    private MensajeEntity mensaje;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @Column(name = "question", nullable = false, length = 500)
    private String question;

    @Column(name = "allow_multiple", nullable = false)
    private boolean allowMultiple;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private UsuarioEntity createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "activo", nullable = false)
    private boolean activo = true;

    @OneToMany(mappedBy = "encuesta", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC, id ASC")
    private List<EncuestaOpcionEntity> opciones = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public MensajeEntity getMensaje() {
        return mensaje;
    }

    public void setMensaje(MensajeEntity mensaje) {
        this.mensaje = mensaje;
    }

    public ChatEntity getChat() {
        return chat;
    }

    public void setChat(ChatEntity chat) {
        this.chat = chat;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public boolean isAllowMultiple() {
        return allowMultiple;
    }

    public void setAllowMultiple(boolean allowMultiple) {
        this.allowMultiple = allowMultiple;
    }

    public UsuarioEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UsuarioEntity createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public List<EncuestaOpcionEntity> getOpciones() {
        return opciones;
    }

    public void setOpciones(List<EncuestaOpcionEntity> opciones) {
        this.opciones = opciones;
    }
}
