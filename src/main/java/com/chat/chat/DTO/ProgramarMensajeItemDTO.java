package com.chat.chat.DTO;

public class ProgramarMensajeItemDTO {
    private Long chatId;
    private String status;
    private Long scheduledMessageId;

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getScheduledMessageId() {
        return scheduledMessageId;
    }

    public void setScheduledMessageId(Long scheduledMessageId) {
        this.scheduledMessageId = scheduledMessageId;
    }
}
