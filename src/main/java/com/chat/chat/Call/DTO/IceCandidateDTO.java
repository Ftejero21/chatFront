package com.chat.chat.Call.DTO;

public class IceCandidateDTO {
    private String callId;
    private Long fromUserId;
    private Long toUserId;
    private String candidate;     // candidate string
    private String sdpMid;        // mid
    private Integer sdpMLineIndex;// m-line index

    // getters/setters
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public Long getFromUserId() { return fromUserId; }
    public void setFromUserId(Long fromUserId) { this.fromUserId = fromUserId; }
    public Long getToUserId() { return toUserId; }
    public void setToUserId(Long toUserId) { this.toUserId = toUserId; }
    public String getCandidate() { return candidate; }
    public void setCandidate(String candidate) { this.candidate = candidate; }
    public String getSdpMid() { return sdpMid; }
    public void setSdpMid(String sdpMid) { this.sdpMid = sdpMid; }
    public Integer getSdpMLineIndex() { return sdpMLineIndex; }
    public void setSdpMLineIndex(Integer sdpMLineIndex) { this.sdpMLineIndex = sdpMLineIndex; }
}
