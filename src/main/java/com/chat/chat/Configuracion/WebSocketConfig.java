package com.chat.chat.Configuracion;

import com.chat.chat.Security.WebSocketRateLimitInterceptor;
import com.chat.chat.Security.WsClientIpHandshakeInterceptor;
import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private WebSocketSecurityInterceptor webSocketSecurityInterceptor;

    @Autowired
    private WebSocketRateLimitInterceptor webSocketRateLimitInterceptor;

    @Autowired
    private WsClientIpHandshakeInterceptor wsClientIpHandshakeInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(Constantes.WS_ENDPOINT)
                .setAllowedOriginPatterns(Constantes.CORS_ANY_ORIGIN)
                .addInterceptors(wsClientIpHandshakeInterceptor)
                .withSockJS()
                .setInterceptors(wsClientIpHandshakeInterceptor)
                .setStreamBytesLimit(512 * 1024)
                .setHttpMessageCacheSize(1000)
                .setDisconnectDelay(30_000);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes(Constantes.WS_APP_PREFIX);
        registry.enableSimpleBroker(Constantes.WS_BROKER_TOPIC, Constantes.WS_BROKER_QUEUE);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry
                .setMessageSizeLimit(256 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(25_000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketSecurityInterceptor, webSocketRateLimitInterceptor);
    }
}