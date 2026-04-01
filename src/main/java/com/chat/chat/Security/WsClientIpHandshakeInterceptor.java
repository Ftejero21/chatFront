package com.chat.chat.Security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class WsClientIpHandshakeInterceptor implements HandshakeInterceptor {

    private static final String SESSION_CLIENT_IP = "clientIp";

    private final ClientIpResolver clientIpResolver;

    public WsClientIpHandshakeInterceptor(ClientIpResolver clientIpResolver) {
        this.clientIpResolver = clientIpResolver;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, org.springframework.http.server.ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String ip = clientIpResolver.resolve(servletRequest.getServletRequest());
            attributes.put(SESSION_CLIENT_IP, ip);
        } else {
            attributes.put(SESSION_CLIENT_IP, "unknown");
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, org.springframework.http.server.ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op
    }
}
