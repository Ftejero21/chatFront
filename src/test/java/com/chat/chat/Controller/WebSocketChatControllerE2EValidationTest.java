package com.chat.chat.Controller;

import com.chat.chat.Configuracion.EstadoUsuarioManager;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.CallService.CallService;
import com.chat.chat.Service.MensajeriaService.MensajeriaService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketChatControllerE2EValidationTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private EstadoUsuarioManager estadoUsuarioManager;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private ChatGrupalRepository chatGrupalRepository;
    @Mock
    private MensajeriaService mensajeriaService;
    @Mock
    private CallService callService;
    @Mock
    private SecurityUtils securityUtils;

    @InjectMocks
    private WebSocketChatController controller;

    @Test
    void rechazaSiEmisorNoTienePublicKey() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", false);
        UsuarioEntity recipient = usuario(16L, "luis@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeText(groupId, payloadE2EGroup(Map.of("16", "env16")));
        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, never()).guardarMensajeGrupal(any());
        verify(messagingTemplate, never()).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), any());

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, times(1))
                .convertAndSendToUser(eq("irene@gmail.com"), eq(Constantes.WS_QUEUE_ERRORS), payloadCaptor.capture());
        Map<?, ?> error = assertInstanceOf(Map.class, payloadCaptor.getValue());
        assertEquals(Constantes.ERR_E2E_SENDER_KEY_MISSING, error.get("code"));
    }

    @Test
    void rechazaSiForReceptoresNoCoincideConMiembrosActivos() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", true);
        UsuarioEntity recipient1 = usuario(16L, "luis@gmail.com", true);
        UsuarioEntity recipient2 = usuario(17L, "ana@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient1, recipient2);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeText(groupId, payloadE2EGroup(Map.of("16", "env16")));
        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, never()).guardarMensajeGrupal(any());
        verify(messagingTemplate, never()).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), any());

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, times(1))
                .convertAndSendToUser(eq("irene@gmail.com"), eq(Constantes.WS_QUEUE_ERRORS), payloadCaptor.capture());
        Map<?, ?> error = assertInstanceOf(Map.class, payloadCaptor.getValue());
        assertEquals(Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH, error.get("code"));
    }

    @Test
    void persisteYEmiteCuandoPayloadE2eGroupEsValido() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", true);
        UsuarioEntity recipient1 = usuario(16L, "luis@gmail.com", true);
        UsuarioEntity recipient2 = usuario(17L, "ana@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient1, recipient2);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeText(groupId, payloadE2EGroup(Map.of("16", "env16", "17", "env17")));
        MensajeDTO saved = new MensajeDTO();
        saved.setId(999L);
        saved.setReceptorId(groupId);
        saved.setEmisorId(senderId);
        saved.setTipo(Constantes.TIPO_TEXT);
        saved.setContenido(dto.getContenido());
        when(mensajeriaService.guardarMensajeGrupal(any(MensajeDTO.class))).thenReturn(saved);

        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, times(1)).guardarMensajeGrupal(any(MensajeDTO.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), eq(saved));
        verify(messagingTemplate, never()).convertAndSendToUser(eq("irene@gmail.com"), eq(Constantes.WS_QUEUE_ERRORS), any());
    }

    @Test
    void rechazaAudioSiPayloadE2eGroupAudioEsInvalido() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", true);
        UsuarioEntity recipient1 = usuario(16L, "luis@gmail.com", true);
        UsuarioEntity recipient2 = usuario(17L, "ana@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient1, recipient2);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeAudio(groupId, payloadE2EGroupAudio(Map.of("16", "env16", "17", "env17"), false));
        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, never()).guardarMensajeGrupal(any());
        verify(messagingTemplate, never()).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), any());

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, times(1))
                .convertAndSendToUser(eq("irene@gmail.com"), eq(Constantes.WS_QUEUE_ERRORS), payloadCaptor.capture());
        Map<?, ?> error = assertInstanceOf(Map.class, payloadCaptor.getValue());
        assertEquals(Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID, error.get("code"));
    }

    @Test
    void rechazaAudioSiForReceptoresNoCoincideConMiembrosActivos() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", true);
        UsuarioEntity recipient1 = usuario(16L, "luis@gmail.com", true);
        UsuarioEntity recipient2 = usuario(17L, "ana@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient1, recipient2);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeAudio(groupId, payloadE2EGroupAudio(Map.of("16", "env16"), true));
        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, never()).guardarMensajeGrupal(any());
        verify(messagingTemplate, never()).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), any());

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, times(1))
                .convertAndSendToUser(eq("irene@gmail.com"), eq(Constantes.WS_QUEUE_ERRORS), payloadCaptor.capture());
        Map<?, ?> error = assertInstanceOf(Map.class, payloadCaptor.getValue());
        assertEquals(Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH, error.get("code"));
    }

    @Test
    void permiteAudioLegacyEnClaroSinRomperCompatibilidad() {
        Long senderId = 21L;
        Long groupId = 60L;

        UsuarioEntity sender = usuario(senderId, "irene@gmail.com", true);
        UsuarioEntity recipient1 = usuario(16L, "luis@gmail.com", true);
        UsuarioEntity recipient2 = usuario(17L, "ana@gmail.com", true);
        ChatGrupalEntity chat = chat(groupId, sender, recipient1, recipient2);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findFreshById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findByIdWithUsuarios(groupId)).thenReturn(Optional.of(chat));

        MensajeDTO dto = mensajeAudio(groupId, "legacy-audio-metadata");
        MensajeDTO saved = new MensajeDTO();
        saved.setId(1001L);
        saved.setReceptorId(groupId);
        saved.setEmisorId(senderId);
        saved.setTipo(Constantes.TIPO_AUDIO);
        saved.setContenido(dto.getContenido());
        when(mensajeriaService.guardarMensajeGrupal(any(MensajeDTO.class))).thenReturn(saved);

        controller.enviarMensajeGrupal(dto);

        verify(mensajeriaService, times(1)).guardarMensajeGrupal(any(MensajeDTO.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), eq(saved));
    }

    private static UsuarioEntity usuario(Long id, String email, boolean withPublicKey) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setEmail(email);
        u.setActivo(true);
        u.setPublicKey(withPublicKey ? "PUBLIC_KEY_" + id : null);
        return u;
    }

    private static ChatGrupalEntity chat(Long id, UsuarioEntity... members) {
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(id);
        chat.setActivo(true);
        chat.setUsuarios(List.of(members));
        return chat;
    }

    private static MensajeDTO mensajeText(Long groupId, String payload) {
        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_TEXT);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido(payload);
        return dto;
    }

    private static MensajeDTO mensajeAudio(Long groupId, String payload) {
        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_AUDIO);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido(payload);
        return dto;
    }

    private static String payloadE2EGroup(Map<String, String> recipients) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"E2E_GROUP\",\"iv\":\"iv\",\"ciphertext\":\"cipher\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",\"forReceptores\":{");
        boolean first = true;
        for (Map.Entry<String, String> entry : recipients.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(entry.getKey()).append('"').append(':')
                    .append('"').append(entry.getValue()).append('"');
        }
        sb.append("}}");
        return sb.toString();
    }

    private static String payloadE2EGroupAudio(Map<String, String> recipients, boolean includeAudioUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"E2E_GROUP_AUDIO\",\"ivFile\":\"ivf\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",");
        if (includeAudioUrl) {
            sb.append("\"audioUrl\":\"/uploads/voice/audio.enc\",");
        }
        sb.append("\"forReceptores\":{");
        boolean first = true;
        for (Map.Entry<String, String> entry : recipients.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('\"').append(entry.getKey()).append('\"').append(':')
                    .append('\"').append(entry.getValue()).append('\"');
        }
        sb.append("}}");
        return sb.toString();
    }
}
