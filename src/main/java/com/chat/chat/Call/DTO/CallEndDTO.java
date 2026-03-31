package com.chat.chat.Call.DTO;

public class CallEndDTO {

    private String callId;
    private Long byUserId; // quién cuelga

    // getters/setters
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getByUserId() { return byUserId; }
    public void setByUserId(Long byUserId) { this.byUserId = byUserId; }
}
