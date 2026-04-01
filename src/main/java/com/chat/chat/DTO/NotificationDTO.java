package com.chat.chat.DTO;

import com.chat.chat.Utils.NotificationType;

import java.time.LocalDateTime;

public class NotificationDTO {
    private Long id;
    private Long userId;
    private NotificationType type;
    private String payloadJson;     // lo mandamos tal cual (simple y flexible)
    private boolean seen;
    private LocalDateTime createdAt;

    private boolean resolved;


    // getters/setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public NotificationType getType() { return type; }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }

    public void setType(NotificationType type) { this.type = type; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
    public boolean isSeen() { return seen; }
    public void setSeen(boolean seen) { this.seen = seen; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
