package com.chat.chat.Service.ChatService;

import com.chat.chat.DTO.ChatClearResponseDTO;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.ChatUserStateEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplClearChatTest {

    @Mock
    private UsuarioRepository usuarioRepo;
    @Mock
    private ChatRepository chatRepository;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private ChatUserStateService chatUserStateService;

    @InjectMocks
    private ChatServiceImpl service;

    @Test
    void clearChatPersisteCorteYDevuelvePayloadEsperado() {
        Long chatId = 90L;
        Long requesterId = 10L;
        LocalDateTime clearedAt = LocalDateTime.of(2026, 3, 29, 12, 0);

        UsuarioEntity requester = usuario(requesterId, "Ana", "Lopez");
        ChatIndividualEntity chat = new ChatIndividualEntity();
        chat.setId(chatId);
        chat.setUsuario1(requester);
        chat.setUsuario2(usuario(20L, "Luis", "Perez"));

        ChatUserStateEntity state = new ChatUserStateEntity();
        state.setChat(chat);
        state.setUser(requester);
        state.setClearedBeforeMessageId(77L);
        state.setClearedAt(clearedAt);

        when(securityUtils.getAuthenticatedUserId()).thenReturn(requesterId);
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(usuarioRepo.findById(requesterId)).thenReturn(Optional.of(requester));
        when(mensajeRepository.findMaxIdByChatId(chatId)).thenReturn(Optional.of(77L));
        when(chatUserStateService.upsertClearState(eq(chat), eq(requester), eq(77L), any(LocalDateTime.class)))
                .thenReturn(state);

        ChatClearResponseDTO out = service.clearChat(chatId);

        assertTrue(out.isOk());
        assertEquals(chatId, out.getChatId());
        assertEquals(requesterId, out.getUserId());
        assertEquals(77L, out.getClearedBeforeMessageId());
        assertEquals(clearedAt, out.getClearedAt());
    }

    @Test
    void clearChatRechazaSiNoPerteneceAlChat() {
        Long chatId = 95L;
        Long requesterId = 10L;

        ChatIndividualEntity chat = new ChatIndividualEntity();
        chat.setId(chatId);
        chat.setUsuario1(usuario(1L, "A", "B"));
        chat.setUsuario2(usuario(2L, "C", "D"));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(requesterId);
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat));

        assertThrows(AccessDeniedException.class, () -> service.clearChat(chatId));
        verifyNoInteractions(chatUserStateService);
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
