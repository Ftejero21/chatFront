package com.chat.chat.Call.DTO;

public class CallInviteDTO {
    private Long callerId;
    private Long calleeId;
    private Long chatId; // opcional, por si quieres asociar

    // getters/setters
    public Long getCallerId() { return callerId; }
    public void setCallerId(Long callerId) { this.callerId = callerId; }
    public Long getCalleeId() { return calleeId; }
    public void setCalleeId(Long calleeId) { this.calleeId = calleeId; }
    public Long getChatId() { return chatId; }
    public void setChatId(Long chatId) { this.chatId = chatId; }
}