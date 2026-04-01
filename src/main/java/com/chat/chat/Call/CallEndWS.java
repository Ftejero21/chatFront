package com.chat.chat.Call;

import com.chat.chat.Utils.Constantes;

public class CallEndWS {
    private String event = Constantes.CALL_EVENT_ENDED;
    private String callId;
    private Long byUserId; // quién colgó
    private Long notifyUserId; // a quién se notifica

    // getters/setters
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getByUserId() { return byUserId; }
    public void setByUserId(Long byUserId) { this.byUserId = byUserId; }
    public Long getNotifyUserId() { return notifyUserId; }
    public void setNotifyUserId(Long notifyUserId) { this.notifyUserId = notifyUserId; }
}
