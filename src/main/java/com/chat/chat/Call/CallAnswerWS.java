package com.chat.chat.Call;

import com.chat.chat.Utils.Constantes;

public class CallAnswerWS {
    private String event = Constantes.CALL_EVENT_ANSWER;
    private String callId;
    private boolean accepted;
    private Long fromUserId; // quién responde (normalmente el callee)
    private Long toUserId;   // a quién se notifica (normalmente el caller)
    private String reason;   // opcional

    // getters/setters
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public Long getFromUserId() { return fromUserId; }
    public void setFromUserId(Long fromUserId) { this.fromUserId = fromUserId; }
    public Long getToUserId() { return toUserId; }
    public void setToUserId(Long toUserId) { this.toUserId = toUserId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
