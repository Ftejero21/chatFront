package com.chat.chat.Entity;

import com.chat.chat.Utils.InviteStatus;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_invites")
public class GroupInviteEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false) private ChatGrupalEntity chat;
    @ManyToOne(optional = false) private UsuarioEntity inviter;
    @ManyToOne(optional = false) private UsuarioEntity invitee;

    @Enumerated(EnumType.STRING) private InviteStatus status = InviteStatus.PENDING;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime respondedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ChatGrupalEntity getChat() {
        return chat;
    }

    public void setChat(ChatGrupalEntity chat) {
        this.chat = chat;
    }

    public UsuarioEntity getInviter() {
        return inviter;
    }

    public void setInviter(UsuarioEntity inviter) {
        this.inviter = inviter;
    }

    public UsuarioEntity getInvitee() {
        return invitee;
    }

    public void setInvitee(UsuarioEntity invitee) {
        this.invitee = invitee;
    }

    public InviteStatus getStatus() {
        return status;
    }

    public void setStatus(InviteStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getRespondedAt() {
        return respondedAt;
    }

    public void setRespondedAt(LocalDateTime respondedAt) {
        this.respondedAt = respondedAt;
    }
}