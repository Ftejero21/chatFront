package com.chat.chat.Configuracion;

import com.chat.chat.Utils.Constantes;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.messaging.MessageSecurityMetadataSourceRegistry;
import org.springframework.security.config.annotation.web.socket.AbstractSecurityWebSocketMessageBrokerConfigurer;

@Configuration
public class WebSocketSecurityConfig extends AbstractSecurityWebSocketMessageBrokerConfigurer {

    @Override
    protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
        // Permitimos todo aquí porque ya tenemos nuestro propio
        // WebSocketSecurityInterceptor
        // que valida los tokens JWT en el CONNECT. Si activamos seguridad estricta aquí
        // de CSRF,
        // bloqueará los envíos cruzados de messagingTemplate.convertAndSend resultando
        // en Error 403.
        messages
                .simpSubscribeDestMatchers(Constantes.TOPIC_ADMIN_SOLICITUDES_DESBANEO).hasRole(Constantes.ADMIN)
                .anyMessage().permitAll();
    }

    @Override
    protected boolean sameOriginDisabled() {
        return true; // Deshabilita CSRF estricto de origen cruzado para WebSockets requeridos por
                     // Angular
    }
}
