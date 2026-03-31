package com.chat.chat.Security;

import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class WebSocketRateLimitInterceptor implements ChannelInterceptor {

    private static final int WS_CHAT_LIMIT = 180;
    private static final Duration WS_CHAT_WINDOW = Duration.ofMinutes(1);
    private static final int WS_REACTION_LIMIT = 240;
    private static final Duration WS_REACTION_WINDOW = Duration.ofMinutes(1);
    private static final int WS_CALL_LIMIT = 60;
    private static final Duration WS_CALL_WINDOW = Duration.ofMinutes(1);
    private static final int WS_MISC_LIMIT = 120;
    private static final Duration WS_MISC_WINDOW = Duration.ofMinutes(1);

    private final InMemoryRateLimiterService limiter;
    private final ClientIpResolver clientIpResolver;
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    public WebSocketRateLimitInterceptor(InMemoryRateLimiterService limiter,
                                         ClientIpResolver clientIpResolver,
                                         ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.limiter = limiter;
        this.clientIpResolver = clientIpResolver;
        this.messagingTemplateProvider = messagingTemplateProvider;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.SEND.equals(accessor.getCommand())) {
            return message;
        }

        String destination = accessor.getDestination();
        if (destination == null || destination.isBlank()) {
            return message;
        }

        WsLimitRule rule = resolveRule(destination);
        if (rule == null) {
            return message;
        }

        String ip = clientIpResolver.resolve(accessor);
        String user = resolveUser(accessor);
        String key = "ws:" + rule.key() + ":" + ip + ":" + user;
        RateLimitDecision decision = limiter.consume(key, rule.limit(), rule.window());
        if (decision.allowed()) {
            return message;
        }

        sendWsRateLimitError(accessor, destination, decision.retryAfterSeconds());
        return null;
    }

    private WsLimitRule resolveRule(String destination) {
        if (destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CHAT_INDIVIDUAL)
                || destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CHAT_GRUPAL)
                || destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CHAT_EDITAR)) {
            return new WsLimitRule("chat", WS_CHAT_LIMIT, WS_CHAT_WINDOW);
        }
        if (destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CHAT_REACCION)) {
            return new WsLimitRule("reaction", WS_REACTION_LIMIT, WS_REACTION_WINDOW);
        }
        if (destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CALL_START)
                || destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CALL_ANSWER)
                || destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CALL_END)) {
            return new WsLimitRule("call", WS_CALL_LIMIT, WS_CALL_WINDOW);
        }
        if (destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_CHAT_ELIMINAR)
                || destination.equals(Constantes.WS_APP_PREFIX + Constantes.WS_APP_MENSAJES_MARCAR_LEIDOS)) {
            return new WsLimitRule("misc", WS_MISC_LIMIT, WS_MISC_WINDOW);
        }
        return null;
    }

    private String resolveUser(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null || accessor.getUser().getName() == null || accessor.getUser().getName().isBlank()) {
            return "anon";
        }
        return accessor.getUser().getName().trim().toLowerCase(Locale.ROOT);
    }

    private void sendWsRateLimitError(StompHeaderAccessor accessor, String destination, long retryAfterSeconds) {
        if (accessor.getUser() == null || accessor.getUser().getName() == null || accessor.getUser().getName().isBlank()) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", Constantes.ERR_RATE_LIMIT);
        payload.put("message", "Rate limit excedido para " + destination + ". Reintenta en " + retryAfterSeconds + " segundos.");
        payload.put("destination", destination);
        payload.put("retryAfterSeconds", retryAfterSeconds);
        payload.put("ts", LocalDateTime.now().toString());
        SimpMessagingTemplate messagingTemplate = messagingTemplateProvider.getIfAvailable();
        if (messagingTemplate != null) {
            messagingTemplate.convertAndSendToUser(accessor.getUser().getName(), Constantes.WS_QUEUE_ERRORS, payload);
        }
    }

    private record WsLimitRule(String key, int limit, Duration window) {
    }
}
