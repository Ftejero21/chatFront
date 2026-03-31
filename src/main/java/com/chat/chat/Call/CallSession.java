package com.chat.chat.Call;

public class CallSession {

    public enum Status { RINGING, ACTIVE, ENDED }

    private final String callId;
    private final Long callerId;
    private final Long calleeId;
    private Status status;

    public CallSession(String callId, Long callerId, Long calleeId) {
        this.callId = callId;
        this.callerId = callerId;
        this.calleeId = calleeId;
        this.status = Status.RINGING;
    }

    public String getCallId() { return callId; }
    public Long getCallerId() { return callerId; }
    public Long getCalleeId() { return calleeId; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
}
