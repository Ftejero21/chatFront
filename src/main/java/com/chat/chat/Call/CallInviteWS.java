package com.chat.chat.Call;

import com.chat.chat.Utils.Constantes;

public class CallInviteWS {
    private String event = Constantes.CALL_EVENT_INVITE; // para tu type-guard en TS
    private String callId;
    private Long callerId;
    private String callerNombre;
    private String callerApellido;
    private Long calleeId;
    private Long chatId; // opcional

    // getters/setters
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getCallerId() { return callerId; }
    public void setCallerId(Long callerId) { this.callerId = callerId; }
    public String getCallerNombre() { return callerNombre; }
    public void setCallerNombre(String callerNombre) { this.callerNombre = callerNombre; }
    public String getCallerApellido() { return callerApellido; }
    public void setCallerApellido(String callerApellido) { this.callerApellido = callerApellido; }
    public Long getCalleeId() { return calleeId; }
    public void setCalleeId(Long calleeId) { this.calleeId = calleeId; }
    public Long getChatId() { return chatId; }
    public void setChatId(Long chatId) { this.chatId = chatId; }
}
