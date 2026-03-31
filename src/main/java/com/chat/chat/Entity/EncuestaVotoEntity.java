package com.chat.chat.Entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "poll_vote",
        indexes = {
                @Index(name = "idx_poll_vote_poll", columnList = "poll_id"),
                @Index(name = "idx_poll_vote_poll_user", columnList = "poll_id,user_id"),
                @Index(name = "idx_poll_vote_option", columnList = "option_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_poll_vote_unique", columnNames = {"poll_id", "option_id", "user_id"})
        }
)
public class EncuestaVotoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "poll_id", nullable = false)
    private EncuestaEntity encuesta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id", nullable = false)
    private EncuestaOpcionEntity opcion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UsuarioEntity usuario;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
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

    public EncuestaEntity getEncuesta() {
        return encuesta;
    }

    public void setEncuesta(EncuestaEntity encuesta) {
        this.encuesta = encuesta;
    }

    public EncuestaOpcionEntity getOpcion() {
        return opcion;
    }

    public void setOpcion(EncuestaOpcionEntity opcion) {
        this.opcion = opcion;
    }

    public UsuarioEntity getUsuario() {
        return usuario;
    }

    public void setUsuario(UsuarioEntity usuario) {
        this.usuario = usuario;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
