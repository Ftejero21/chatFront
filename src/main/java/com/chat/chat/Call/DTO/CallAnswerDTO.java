package com.chat.chat.Call.DTO;

public class CallAnswerDTO {

    private String callId;
    private Long callerId; // quién llamó originalmente
    private Long calleeId; // quién recibe la llamada
    private boolean accepted; // true = acepta, false = rechaza
    private String reason; // opcional: "REJECTED" | "BUSY" | "NO_ANSWER"...

    // getters/setters
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getCallerId() { return callerId; }
    public void setCallerId(Long callerId) { this.callerId = callerId; }
    public Long getCalleeId() { return calleeId; }
    public void setCalleeId(Long calleeId) { this.calleeId = calleeId; }
    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
