package com.chat.chat.Service.ChatService;

import com.chat.chat.DTO.ChatMensajeBusquedaPageDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.chat.chat.Utils.MessageType;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplBuscarMensajesTest {

    @Mock
    private UsuarioRepository usuarioRepo;
    @Mock
    private ChatIndividualRepository chatIndRepo;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private ChatRepository chatRepository;
    @Mock
    private ChatGrupalRepository chatGrupalRepo;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private AdminAuditCrypto adminAuditCrypto;
    @Mock
    private ChatUserStateService chatUserStateService;

    @InjectMocks
    private ChatServiceImpl service;

    @Test
    void priorizaPrefijoYSoportaBusquedaAccentInsensitive() {
        Long requesterId = 50L;
        Long chatId = 101L;

        UsuarioEntity requester = usuario(requesterId, "Ana", "Lopez");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(chatId);
        chat.setActivo(true);
        chat.setUsuarios(List.of(requester));

        MensajeEntity prefijoConForAdmin = mensaje(
                3L,
                chat,
                usuario(7L, "Irene", "Diaz"),
                "{\"type\":\"E2E\",\"iv\":\"iv\",\"ciphertext\":\"cipher\",\"forEmisor\":\"e\",\"forReceptor\":\"r\",\"forAdmin\":\"ENC_ADMIN\"}",
                LocalDateTime.of(2026, 2, 20, 11, 0)
        );
        MensajeEntity prefijoConAcento = mensaje(
                1L,
                chat,
                usuario(8L, "Luis", "Perez"),
                "Árbol pequeño",
                LocalDateTime.of(2026, 2, 19, 11, 0)
        );
        MensajeEntity contiene = mensaje(
                2L,
                chat,
                usuario(9L, "Marta", "Ruiz"),
                "texto con arbol al medio",
                LocalDateTime.of(2026, 2, 21, 11, 0)
        );
        MensajeEntity sinMatch = mensaje(
                4L,
                chat,
                usuario(10L, "Carlos", "Soto"),
                "mensaje sin coincidencia",
                LocalDateTime.of(2026, 2, 22, 11, 0)
        );

        when(securityUtils.getAuthenticatedUserId()).thenReturn(requesterId);
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(chatUserStateService.resolveCutoff(chatId, requesterId)).thenReturn(null);
        when(mensajeRepository.findTextActivosByChatIdOrderByFechaEnvioDescIdDesc(chatId, MessageType.TEXT, null))
                .thenReturn(List.of(sinMatch, contiene, prefijoConForAdmin, prefijoConAcento));
        when(adminAuditCrypto.decryptBase64Envelope("ENC_ADMIN")).thenReturn("arbol secreto");

        ChatMensajeBusquedaPageDTO out = service.buscarMensajesEnChat(chatId, "ARBOL", 0, 2);

        assertEquals(3, out.getTotal());
        assertEquals(2, out.getItems().size());
        assertTrue(out.isHasMore());

        assertEquals(3L, out.getItems().get(0).getId());
        assertEquals(1L, out.getItems().get(1).getId());
        assertEquals(0, out.getItems().get(0).getMatchStart());
        assertEquals(5, out.getItems().get(0).getMatchEnd());
        verify(adminAuditCrypto).decryptBase64Envelope("ENC_ADMIN");
    }

    @Test
    void rechazaSiUsuarioNoPerteneceAlChat() {
        Long requesterId = 99L;
        Long chatId = 500L;

        ChatIndividualEntity chat = new ChatIndividualEntity();
        chat.setId(chatId);
        chat.setUsuario1(usuario(1L, "A", "B"));
        chat.setUsuario2(usuario(2L, "C", "D"));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(requesterId);
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat));

        assertThrows(AccessDeniedException.class,
                () -> service.buscarMensajesEnChat(chatId, "hola", 0, 20));
    }

    private static MensajeEntity mensaje(Long id,
                                         com.chat.chat.Entity.ChatEntity chat,
                                         UsuarioEntity emisor,
                                         String contenido,
                                         LocalDateTime fechaEnvio) {
        MensajeEntity m = new MensajeEntity();
        m.setId(id);
        m.setChat(chat);
        m.setEmisor(emisor);
        m.setContenido(contenido);
        m.setTipo(MessageType.TEXT);
        m.setActivo(true);
        m.setFechaEnvio(fechaEnvio);
        return m;
    }

    private static UsuarioEntity usuario(Long id, String nombre, String apellido) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setNombre(nombre);
        u.setApellido(apellido);
        u.setActivo(true);
        return u;
    }
}
