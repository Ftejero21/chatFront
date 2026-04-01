package com.chat.chat.DTO;

public class AudioGrabandoGrupoDTO {
    private Long emisorId;
    private Long chatId;
    private boolean grabandoAudio;

    public Long getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(Long emisorId) {
        this.emisorId = emisorId;
    }

    public Long getChatId() {
        return chatId;
    }

    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }

    public boolean isGrabandoAudio() {
        return grabandoAudio;
    }

    public void setGrabandoAudio(boolean grabandoAudio) {
        this.grabandoAudio = grabandoAudio;
    }
}
