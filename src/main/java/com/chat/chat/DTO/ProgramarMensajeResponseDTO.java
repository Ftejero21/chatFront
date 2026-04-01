package com.chat.chat.DTO;

import java.util.List;

public class ProgramarMensajeResponseDTO {
    private boolean ok;
    private String scheduledBatchId;
    private List<ProgramarMensajeItemDTO> items;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public String getScheduledBatchId() {
        return scheduledBatchId;
    }

    public void setScheduledBatchId(String scheduledBatchId) {
        this.scheduledBatchId = scheduledBatchId;
    }

    public List<ProgramarMensajeItemDTO> getItems() {
        return items;
    }

    public void setItems(List<ProgramarMensajeItemDTO> items) {
        this.items = items;
    }
}
