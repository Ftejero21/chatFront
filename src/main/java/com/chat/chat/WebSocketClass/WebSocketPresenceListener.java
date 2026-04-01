package com.chat.chat.WebSocketClass;

import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketPresenceListener {
    private static final String LOG_WS_USER_CONNECT = "El usuario con ID ";
    private static final String LOG_WS_CONNECT_SUFFIX = " se ha conectado.";
    private static final String LOG_WS_SIN_USUARIO = "Conexión sin usuarioId.";
    private static final String LOG_WS_USER_DISCONNECT = "El usuario con ID ";
    private static final String LOG_WS_DISCONNECT_SUFFIX = " se ha desconectado.";
    private static final String LOG_WS_SESION_DESCONOCIDA = "Desconexión de sesión desconocida: ";

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private static final Map<String, String> sesionesUsuario = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor sha = StompHeaderAccessor.wrap(event.getMessage());
        String userId = sha.getFirstNativeHeader(Constantes.HEADER_USUARIO_ID);

        if (userId != null) {
            sesionesUsuario.put(sha.getSessionId(), userId);
            messagingTemplate.convertAndSend(Constantes.TOPIC_ESTADO + userId, Constantes.ESTADO_CONECTADO);
        } else {
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String userId = sesionesUsuario.remove(sessionId);

        if (userId != null) {
            messagingTemplate.convertAndSend(Constantes.TOPIC_ESTADO + userId, Constantes.ESTADO_DESCONECTADO);
        } else {
        }
    }
}
