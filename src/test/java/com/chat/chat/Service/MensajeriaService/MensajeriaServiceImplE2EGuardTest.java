package com.chat.chat.Service.MensajeriaService;

import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.E2EGroupValidationException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.EncuestaService.EncuestaService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MensajeriaServiceImplE2EGuardTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private ChatIndividualRepository chatIndividualRepository;
    @Mock
    private ChatGrupalRepository chatGrupalRepository;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private EncuestaService encuestaService;

    @InjectMocks
    private MensajeriaServiceImpl service;

    @Test
    void rechazaPersistenciaCuandoEmisorNoTienePublicKey() {
        Long senderId = 21L;
        Long groupId = 60L;
        Long recipientId = 16L;

        UsuarioEntity sender = usuario(senderId, null);
        UsuarioEntity recipient = usuario(recipientId, "PUBLIC_KEY_16");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(List.of(sender, recipient));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepository.findFreshById(recipientId)).thenReturn(Optional.of(recipient));

        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_TEXT);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido("{\"type\":\"E2E_GROUP\",\"iv\":\"iv\",\"ciphertext\":\"cipher\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",\"forReceptores\":{\"16\":\"env16\"}}");

        E2EGroupValidationException ex = assertThrows(E2EGroupValidationException.class, () -> service.guardarMensajeGrupal(dto));
        assertEquals(Constantes.ERR_E2E_SENDER_KEY_MISSING, ex.getCode());
        verify(mensajeRepository, never()).save(any());
    }

    @Test
    void rechazaPersistenciaCuandoFaltanReceptoresEnForReceptores() {
        Long senderId = 21L;
        Long groupId = 60L;
        Long recipient1Id = 16L;
        Long recipient2Id = 17L;

        UsuarioEntity sender = usuario(senderId, "PUBLIC_KEY_21");
        UsuarioEntity recipient1 = usuario(recipient1Id, "PUBLIC_KEY_16");
        UsuarioEntity recipient2 = usuario(recipient2Id, "PUBLIC_KEY_17");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(List.of(sender, recipient1, recipient2));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepository.findFreshById(recipient1Id)).thenReturn(Optional.of(recipient1));
        when(usuarioRepository.findFreshById(recipient2Id)).thenReturn(Optional.of(recipient2));

        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_TEXT);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido("{\"type\":\"E2E_GROUP\",\"iv\":\"iv\",\"ciphertext\":\"cipher\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",\"forReceptores\":{\"16\":\"env16\"}}");

        E2EGroupValidationException ex = assertThrows(E2EGroupValidationException.class, () -> service.guardarMensajeGrupal(dto));
        assertEquals(Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH, ex.getCode());
        verify(mensajeRepository, never()).save(any());
    }

    @Test
    void rechazaPersistenciaCuandoPayloadE2eGroupAudioEsInvalido() {
        Long senderId = 21L;
        Long groupId = 60L;
        Long recipientId = 16L;

        UsuarioEntity sender = usuario(senderId, "PUBLIC_KEY_21");
        UsuarioEntity recipient = usuario(recipientId, "PUBLIC_KEY_16");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(List.of(sender, recipient));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepository.findFreshById(recipientId)).thenReturn(Optional.of(recipient));

        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_AUDIO);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido("{\"type\":\"E2E_GROUP_AUDIO\",\"ivFile\":\"ivf\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",\"forReceptores\":{\"16\":\"env16\"}}");

        E2EGroupValidationException ex = assertThrows(E2EGroupValidationException.class, () -> service.guardarMensajeGrupal(dto));
        assertEquals(Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID, ex.getCode());
        verify(mensajeRepository, never()).save(any());
    }

    @Test
    void rechazaPersistenciaCuandoFaltanReceptoresEnForReceptoresGroupAudio() {
        Long senderId = 21L;
        Long groupId = 60L;
        Long recipient1Id = 16L;
        Long recipient2Id = 17L;

        UsuarioEntity sender = usuario(senderId, "PUBLIC_KEY_21");
        UsuarioEntity recipient1 = usuario(recipient1Id, "PUBLIC_KEY_16");
        UsuarioEntity recipient2 = usuario(recipient2Id, "PUBLIC_KEY_17");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(List.of(sender, recipient1, recipient2));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatGrupalRepository.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepository.findFreshById(recipient1Id)).thenReturn(Optional.of(recipient1));
        when(usuarioRepository.findFreshById(recipient2Id)).thenReturn(Optional.of(recipient2));

        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_AUDIO);
        dto.setReceptorId(groupId);
        dto.setChatId(groupId);
        dto.setContenido("{\"type\":\"E2E_GROUP_AUDIO\",\"ivFile\":\"ivf\",\"forEmisor\":\"envSender\",\"forAdmin\":\"envAdmin\",\"audioUrl\":\"/uploads/voice/a.enc\",\"forReceptores\":{\"16\":\"env16\"}}");

        E2EGroupValidationException ex = assertThrows(E2EGroupValidationException.class, () -> service.guardarMensajeGrupal(dto));
        assertEquals(Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH, ex.getCode());
        verify(mensajeRepository, never()).save(any());
    }

    @Test
    void rechazaIndividualAudioCuandoPayloadE2eAudioEsInvalido() {
        Long senderId = 21L;
        Long recipientId = 16L;

        UsuarioEntity sender = usuario(senderId, "PUBLIC_KEY_21");
        UsuarioEntity recipient = usuario(recipientId, "PUBLIC_KEY_16");
        ChatIndividualEntity chat = new ChatIndividualEntity();
        chat.setId(99L);
        chat.setUsuario1(sender);
        chat.setUsuario2(recipient);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(senderId);
        when(usuarioRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(usuarioRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(chatIndividualRepository.findByUsuario1AndUsuario2(sender, recipient)).thenReturn(Optional.of(chat));

        MensajeDTO dto = new MensajeDTO();
        dto.setReceptorId(recipientId);
        dto.setAudioUrl("/uploads/voice/a.enc");
        dto.setContenido("{\"type\":\"E2E_AUDIO\",\"ivFile\":\"ivf\",\"forEmisor\":\"envSender\",\"forReceptor\":\"envReceiver\",\"audioUrl\":\"/uploads/voice/a.enc\"}");

        E2EGroupValidationException ex = assertThrows(E2EGroupValidationException.class, () -> service.guardarMensajeIndividual(dto));
        assertEquals(Constantes.ERR_E2E_AUDIO_PAYLOAD_INVALID, ex.getCode());
        verify(mensajeRepository, never()).save(any());
    }

    private static UsuarioEntity usuario(Long id, String publicKey) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setActivo(true);
        u.setPublicKey(publicKey);
        return u;
    }
}
