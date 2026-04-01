package com.chat.chat.DTO;

public class AudioGrabandoDTO {
    private Long emisorId;
    private Long receptorId;
    private boolean grabandoAudio;

    public Long getEmisorId() {
        return emisorId;
    }

    public void setEmisorId(Long emisorId) {
        this.emisorId = emisorId;
    }

    public Long getReceptorId() {
        return receptorId;
    }

    public void setReceptorId(Long receptorId) {
        this.receptorId = receptorId;
    }

    public boolean isGrabandoAudio() {
        return grabandoAudio;
    }

    public void setGrabandoAudio(boolean grabandoAudio) {
        this.grabandoAudio = grabandoAudio;
    }
}
