package com.chat.chat.Entity;

import com.chat.chat.Utils.EstadoMensajeProgramado;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "chat_scheduled_message",
        indexes = {
                @Index(name = "idx_sched_status_scheduled_at", columnList = "status,scheduled_at"),
                @Index(name = "idx_sched_created_by", columnList = "created_by"),
                @Index(name = "idx_sched_lock_until", columnList = "lock_until"),
                @Index(name = "idx_sched_batch", columnList = "scheduled_batch_id")
        }
)
public class MensajeProgramadoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private UsuarioEntity createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @Lob
    @Column(name = "message_content", nullable = false, columnDefinition = "TEXT")
    private String messageContent;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EstadoMensajeProgramado status = EstadoMensajeProgramado.PENDING;

    @Column(name = "attempts", nullable = false)
    private Integer attempts = 0;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "lock_token", length = 80)
    private String lockToken;

    @Column(name = "lock_until")
    private Instant lockUntil;

    @Column(name = "scheduled_batch_id", length = 64)
    private String scheduledBatchId;

    @Column(name = "ws_emitted", nullable = false)
    private boolean wsEmitted = false;

    @Column(name = "ws_emitted_at")
    private Instant wsEmittedAt;

    @Column(name = "ws_destinations", length = 1000)
    private String wsDestinations;

    @Column(name = "ws_emit_error", length = 1000)
    private String wsEmitError;

    @Column(name = "persisted_message_id")
    private Long persistedMessageId;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (attempts == null) {
            attempts = 0;
        }
        if (status == null) {
            status = EstadoMensajeProgramado.PENDING;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UsuarioEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UsuarioEntity createdBy) {
        this.createdBy = createdBy;
    }

    public ChatEntity getChat() {
        return chat;
    }

    public void setChat(ChatEntity chat) {
        this.chat = chat;
    }

    public String getMessageContent() {
        return messageContent;
    }

    public void setMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public EstadoMensajeProgramado getStatus() {
        return status;
    }

    public void setStatus(EstadoMensajeProgramado status) {
        this.status = status;
    }

    public Integer getAttempts() {
        return attempts;
    }

    public void setAttempts(Integer attempts) {
        this.attempts = attempts;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public String getLockToken() {
        return lockToken;
    }

    public void setLockToken(String lockToken) {
        this.lockToken = lockToken;
    }

    public Instant getLockUntil() {
        return lockUntil;
    }

    public void setLockUntil(Instant lockUntil) {
        this.lockUntil = lockUntil;
    }

    public String getScheduledBatchId() {
        return scheduledBatchId;
    }

    public void setScheduledBatchId(String scheduledBatchId) {
        this.scheduledBatchId = scheduledBatchId;
    }

    public boolean isWsEmitted() {
        return wsEmitted;
    }

    public void setWsEmitted(boolean wsEmitted) {
        this.wsEmitted = wsEmitted;
    }

    public Instant getWsEmittedAt() {
        return wsEmittedAt;
    }

    public void setWsEmittedAt(Instant wsEmittedAt) {
        this.wsEmittedAt = wsEmittedAt;
    }

    public String getWsDestinations() {
        return wsDestinations;
    }

    public void setWsDestinations(String wsDestinations) {
        this.wsDestinations = wsDestinations;
    }

    public String getWsEmitError() {
        return wsEmitError;
    }

    public void setWsEmitError(String wsEmitError) {
        this.wsEmitError = wsEmitError;
    }

    public Long getPersistedMessageId() {
        return persistedMessageId;
    }

    public void setPersistedMessageId(Long persistedMessageId) {
        this.persistedMessageId = persistedMessageId;
    }
}
