package com.chat.chat.Service.GroupInviteService;

import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.GroupInviteEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.ConflictoException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.GroupInviteRepo;
import com.chat.chat.Repository.NotificationRepo;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.InviteStatus;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupInviteServiceImplTest {

    @Mock
    private GroupInviteRepo inviteRepo;
    @Mock
    private ChatGrupalRepository chatRepo;
    @Mock
    private UsuarioRepository usuarioRepo;
    @Mock
    private NotificationRepo notificationRepo;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private SecurityUtils securityUtils;

    @InjectMocks
    private GroupInviteServiceImpl service;

    @Test
    void create_rechazaSiNoEsAdminDelGrupo() {
        Long requesterId = 1L;
        Long inviteeId = 2L;
        Long groupId = 99L;

        UsuarioEntity requester = usuario(requesterId, true);
        UsuarioEntity invitee = usuario(inviteeId, true);
        ChatGrupalEntity chat = chat(groupId, List.of(requester), Set.of(), requester);

        when(chatRepo.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepo.findById(requesterId)).thenReturn(Optional.of(requester));
        when(usuarioRepo.findById(inviteeId)).thenReturn(Optional.of(invitee));

        assertThrows(AccessDeniedException.class, () -> service.create(groupId, inviteeId, requesterId));
    }

    @Test
    void create_rechazaDuplicadoPending() {
        Long requesterId = 1L;
        Long inviteeId = 2L;
        Long groupId = 99L;

        UsuarioEntity requester = usuario(requesterId, true);
        UsuarioEntity invitee = usuario(inviteeId, true);
        ChatGrupalEntity chat = chat(groupId, List.of(requester), Set.of(requester), requester);

        when(chatRepo.findById(groupId)).thenReturn(Optional.of(chat));
        when(usuarioRepo.findById(requesterId)).thenReturn(Optional.of(requester));
        when(usuarioRepo.findById(inviteeId)).thenReturn(Optional.of(invitee));
        when(inviteRepo.existsByChatIdAndInviteeIdAndStatus(groupId, inviteeId, InviteStatus.PENDING)).thenReturn(true);

        assertThrows(ConflictoException.class, () -> service.create(groupId, inviteeId, requesterId));
    }

    @Test
    void accept_rechazaSiBodyUserNoCoincideConJWT() {
        Long inviteId = 50L;
        when(securityUtils.getAuthenticatedUserId()).thenReturn(10L);
        assertThrows(AccessDeniedException.class, () -> service.accept(inviteId, 11L));
    }

    private static UsuarioEntity usuario(Long id, boolean activo) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setActivo(activo);
        u.setNombre("U" + id);
        return u;
    }

    private static ChatGrupalEntity chat(Long id, List<UsuarioEntity> usuarios, Set<UsuarioEntity> admins, UsuarioEntity creador) {
        ChatGrupalEntity c = new ChatGrupalEntity();
        c.setId(id);
        c.setActivo(true);
        c.setUsuarios(usuarios);
        c.setAdmins(admins);
        c.setCreador(creador);
        c.setNombreGrupo("Grupo " + id);
        return c;
    }
}
