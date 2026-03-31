package com.chat.chat.Call.DTO;

public class SdpOfferDTO {
    private String callId;
    private Long fromUserId;
    private Long toUserId;
    private String sdp; // SDP en texto

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
