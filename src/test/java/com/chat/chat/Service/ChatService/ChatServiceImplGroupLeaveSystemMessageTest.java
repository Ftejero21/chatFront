package com.chat.chat.Service.ChatService;

import com.chat.chat.Configuracion.EstadoUsuarioManager;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MessagueSalirGrupoDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.GroupInviteRepo;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.NotificationRepo;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MessageType;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplGroupLeaveSystemMessageTest {

    @Mock
    private UsuarioRepository usuarioRepo;
    @Mock
    private ChatIndividualRepository chatIndRepo;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private ChatRepository chatRepository;
    @Mock
    private GroupInviteRepo inviteRepo;
    @Mock
    private NotificationRepo notificationRepo;
    @Mock
    private ChatGrupalRepository chatGrupalRepo;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private EstadoUsuarioManager estadoUsuarioManager;

    @InjectMocks
    private ChatServiceImpl chatService;

    @Test
    void alSalirDeGrupoNoVacio_creaMensajeSystemYEmiteWs() {
        Long groupId = 60L;
        Long userId = 11L;

        UsuarioEntity sale = usuario(userId, "Irene", "Diaz");
        UsuarioEntity otro = usuario(16L, "Luis", "Perez");

        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(new ArrayList<>(List.of(sale, otro)));

        when(chatGrupalRepo.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepo.findById(userId)).thenReturn(Optional.of(sale));
        when(chatGrupalRepo.save(any(ChatGrupalEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mensajeRepository.save(any(MensajeEntity.class))).thenAnswer(inv -> {
            MensajeEntity m = inv.getArgument(0);
            m.setId(999L);
            return m;
        });

        MessagueSalirGrupoDTO result = chatService.salirDeChatGrupal(groupId, userId);

        assertTrue(result.isOk());
        assertFalse(result.isGroupDeleted());
        assertEquals(groupId, result.getGroupId());
        assertEquals(userId, result.getUserId());

        ArgumentCaptor<MensajeEntity> captor = ArgumentCaptor.forClass(MensajeEntity.class);
        verify(mensajeRepository).save(captor.capture());
        MensajeEntity saved = captor.getValue();
        assertEquals(MessageType.SYSTEM, saved.getTipo());
        assertTrue(saved.isActivo());
        assertEquals(chat, saved.getChat());
        assertEquals(sale, saved.getEmisor());
        assertEquals("Irene Diaz ha salido del grupo", saved.getContenido());

        ArgumentCaptor<MensajeDTO> wsPayload = ArgumentCaptor.forClass(MensajeDTO.class);
        verify(messagingTemplate).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + groupId), wsPayload.capture());
        assertEquals(999L, wsPayload.getValue().getId());
        assertEquals(Constantes.TIPO_SYSTEM, wsPayload.getValue().getTipo());
        assertEquals(groupId, wsPayload.getValue().getReceptorId());
    }

    @Test
    void alSalirDeGrupoVacio_noCreaMensajeSystemNiEmiteWs() {
        Long groupId = 70L;
        Long userId = 11L;

        UsuarioEntity sale = usuario(userId, "Irene", "Diaz");
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(groupId);
        chat.setActivo(true);
        chat.setUsuarios(new ArrayList<>(List.of(sale)));

        when(chatGrupalRepo.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepo.findById(userId)).thenReturn(Optional.of(sale));
        when(chatGrupalRepo.save(any(ChatGrupalEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        MessagueSalirGrupoDTO result = chatService.salirDeChatGrupal(groupId, userId);

        assertTrue(result.isOk());
        assertTrue(result.isGroupDeleted());
        verify(mensajeRepository, never()).save(any(MensajeEntity.class));
        verify(messagingTemplate, never()).convertAndSend(any(), any());
    }

    private static UsuarioEntity usuario(Long id, String nombre, String apellido) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setNombre(nombre);
        u.setApellido(apellido);
        return u;
    }
}
