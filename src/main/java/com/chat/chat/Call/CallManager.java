package com.chat.chat.Call;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CallManager {
    private final Map<String, CallSession> calls = new ConcurrentHashMap<>();

    public CallSession create(Long callerId, Long calleeId) {
        String id = UUID.randomUUID().toString();
        CallSession cs = new CallSession(id, callerId, calleeId);
        calls.put(id, cs);
        return cs;
    }

    public CallSession get(String callId) { return calls.get(callId); }

    public void setStatus(String callId, CallSession.Status st) {
        CallSession cs = calls.get(callId);
        if (cs != null) cs.setStatus(st);
    }

    public void end(String callId) {
        CallSession cs = calls.get(callId);
        if (cs != null) cs.setStatus(CallSession.Status.ENDED);
    }
}
