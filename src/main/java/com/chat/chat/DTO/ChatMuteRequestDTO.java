package com.chat.chat.DTO;

public class ChatMuteRequestDTO {

    private Long durationSeconds;
    private Boolean mutedForever;

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public Boolean getMutedForever() {
        return mutedForever;
    }

    public void setMutedForever(Boolean mutedForever) {
        this.mutedForever = mutedForever;
    }
}
