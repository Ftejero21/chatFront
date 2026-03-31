package com.chat.chat.Call.DTO;

public class SdpAnswerDTO {
    private String callId;
    private Long fromUserId; // quien responde
    private Long toUserId;   // a quien se envía
    private String sdp;

    // getters/setters
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getFromUserId() { return fromUserId; }
    public void setFromUserId(Long fromUserId) { this.fromUserId = fromUserId; }
    public Long getToUserId() { return toUserId; }
    public void setToUserId(Long toUserId) { this.toUserId = toUserId; }
    public String getSdp() { return sdp; }
    public void setSdp(String sdp) { this.sdp = sdp; }
}
