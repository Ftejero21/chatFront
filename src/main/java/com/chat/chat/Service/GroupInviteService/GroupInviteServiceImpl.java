package com.chat.chat.Service.GroupInviteService;

import com.chat.chat.DTO.GroupInviteResponseWS;
import com.chat.chat.DTO.GroupInviteWS;
import com.chat.chat.DTO.UnseenCountWS;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.GroupInviteEntity;
import com.chat.chat.Entity.NotificationEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.ConflictoException;
import com.chat.chat.Exceptions.RecursoNoEncontradoException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.GroupInviteRepo;
import com.chat.chat.Repository.NotificationRepo;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.InviteStatus;
import com.chat.chat.Utils.NotificationType;
import com.chat.chat.Utils.SecurityUtils;
import com.chat.chat.Utils.Utils;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Objects;

@Service
public class GroupInviteServiceImpl implements GroupInviteService {
    private static final Logger LOGGER = LoggerFactory.getLogger(GroupInviteServiceImpl.class);

    @Autowired
    private GroupInviteRepo inviteRepo;
    @Autowired
    private ChatGrupalRepository chatRepo;
    @Autowired
    private UsuarioRepository usuarioRepo;
    @Autowired
    private NotificationRepo notificationRepo;
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private SecurityUtils securityUtils;

    @Override
    @Transactional
    public GroupInviteWS create(Long groupId, Long inviteeId, Long requesterId) {
        LOGGER.info("[GROUP_INVITE] create groupId={} inviteeId={} requesterId={}", groupId, inviteeId, requesterId);
        if (groupId == null) {
            throw new IllegalArgumentException(Constantes.MSG_GROUP_ID_OBLIGATORIO);
        }
        if (inviteeId == null) {
            throw new IllegalArgumentException(Constantes.MSG_USUARIO_NO_EXISTE_ID + "null");
        }
        if (requesterId == null) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }

        ChatGrupalEntity chat = chatRepo.findById(groupId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_GRUPO_NO_EXISTE_ID + groupId));
        if (!chat.isActivo()) {
            throw new RecursoNoEncontradoException(Constantes.MSG_GRUPO_NO_EXISTE_ID + groupId);
        }

        UsuarioEntity inviter = usuarioRepo.findById(requesterId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_EXISTE_ID + requesterId));
        UsuarioEntity invitee = usuarioRepo.findById(inviteeId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_EXISTE_ID + inviteeId));

        if (chat.getUsuarios() == null) {
            chat.setUsuarios(new ArrayList<>());
        }

        boolean inviterIsMember = chat.getUsuarios().stream()
                .anyMatch(u -> u != null && Objects.equals(u.getId(), requesterId) && u.isActivo());
        if (!inviterIsMember) {
            throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
        }

        boolean inviterIsAdmin = (chat.getAdmins() != null
                && chat.getAdmins().stream().anyMatch(a -> a != null && Objects.equals(a.getId(), requesterId)))
                || (chat.getCreador() != null && Objects.equals(chat.getCreador().getId(), requesterId));
        if (!inviterIsAdmin) {
            throw new AccessDeniedException(Constantes.MSG_SOLO_ADMIN);
        }

        boolean inviteeAlreadyMember = chat.getUsuarios().stream()
                .anyMatch(u -> u != null && Objects.equals(u.getId(), inviteeId));
        if (inviteeAlreadyMember) {
            throw new ConflictoException(Constantes.MSG_USUARIO_YA_MIEMBRO_GRUPO);
        }

        boolean pendingExists = inviteRepo.existsByChatIdAndInviteeIdAndStatus(groupId, inviteeId, InviteStatus.PENDING);
        if (pendingExists) {
            throw new ConflictoException(Constantes.MSG_INVITACION_PENDIENTE_DUPLICADA);
        }

        GroupInviteEntity inv = new GroupInviteEntity();
        inv.setChat(chat);
        inv.setInviter(inviter);
        inv.setInvitee(invitee);
        inv.setStatus(InviteStatus.PENDING);
        inv.setCreatedAt(LocalDateTime.now());
        inv = inviteRepo.save(inv);

        GroupInviteWS ws = new GroupInviteWS();
        ws.setInviteId(inv.getId());
        ws.setGroupId(chat.getId());
        ws.setGroupName(chat.getNombreGrupo());
        ws.setInviterId(inviter.getId());
        ws.setInviterNombre(inviter.getNombre());

        NotificationEntity notif = new NotificationEntity();
        notif.setUserId(invitee.getId());
        notif.setType(NotificationType.GROUP_INVITE);
        notif.setPayloadJson(Utils.writeJson(ws));
        notif.setSeen(false);
        notificationRepo.save(notif);

        int unseenForInvitee = (int) notificationRepo.countByUserIdAndSeenFalse(invitee.getId());
        ws.setUnseenCount(unseenForInvitee);
        Utils.sendNotif(messagingTemplate, invitee.getId(), ws);

        return ws;
    }

    @Override
    @Transactional
    public void accept(Long inviteId, Long userId) {
        LOGGER.info("[GROUP_INVITE] accept inviteId={} userId={}", inviteId, userId);
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (userId == null) {
            throw new IllegalArgumentException(Constantes.KEY_USER_ID + " es obligatorio");
        }
        if (!Objects.equals(authenticatedUserId, userId)) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }

        GroupInviteEntity inv = inviteRepo.findById(inviteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_INVITACION_NO_EXISTE + inviteId));
        if (!Objects.equals(inv.getInvitee().getId(), authenticatedUserId)) {
            throw new AccessDeniedException(ExceptionConstants.ERROR_INVITE_NOT_FOR_USER);
        }

        if (inv.getStatus() != InviteStatus.PENDING) {
            throw new IllegalArgumentException(Constantes.MSG_INVITACION_YA_RESUELTA);
        }

        inv.setStatus(InviteStatus.ACCEPTED);
        inv.setRespondedAt(LocalDateTime.now());
        inviteRepo.save(inv);

        ChatGrupalEntity chat = inv.getChat();
        if (chat == null || chat.getId() == null || !chat.isActivo()) {
            throw new RecursoNoEncontradoException(Constantes.MSG_GRUPO_NO_EXISTE_ID + (chat == null ? "null" : chat.getId()));
        }

        UsuarioEntity invitee = inv.getInvitee();
        if (chat.getUsuarios() == null) {
            chat.setUsuarios(new ArrayList<>());
        }
        boolean alreadyMember = chat.getUsuarios().stream()
                .anyMatch(u -> u != null && Objects.equals(u.getId(), invitee.getId()));
        if (!alreadyMember) {
            chat.getUsuarios().add(invitee);
        }
        chatRepo.save(chat);

        GroupInviteResponseWS ws = new GroupInviteResponseWS();
        ws.setInviteId(inv.getId());
        ws.setGroupId(chat.getId());
        ws.setGroupName(chat.getNombreGrupo());
        ws.setInviteeId(invitee.getId());
        ws.setInviteeNombre(invitee.getNombre());
        ws.setStatus(InviteStatus.ACCEPTED);

        NotificationEntity notif = new NotificationEntity();
        notif.setUserId(inv.getInviter().getId());
        notif.setType(NotificationType.GROUP_INVITE_RESPONSE);
        notif.setPayloadJson(Utils.writeJson(ws));
        notif.setSeen(false);
        notificationRepo.save(notif);

        int unseenForCreator = (int) notificationRepo.countByUserIdAndSeenFalse(inv.getInviter().getId());
        ws.setUnseenCount(unseenForCreator);
        Utils.sendNotif(messagingTemplate, inv.getInviter().getId(), ws);

        notificationRepo.findFirstByUserIdAndTypeAndPayloadJsonContaining(
                authenticatedUserId, NotificationType.GROUP_INVITE, "\"inviteId\":" + inviteId).ifPresent(n -> {
                    n.setSeen(true);
                    n.setResolved(true);
                    notificationRepo.save(n);
                });

        int unseenForInvitee = (int) notificationRepo.countByUserIdAndSeenFalse(authenticatedUserId);
        Utils.sendNotif(messagingTemplate, authenticatedUserId, new UnseenCountWS(authenticatedUserId, unseenForInvitee));
    }

    @Override
    @Transactional
    public void decline(Long inviteId, Long userId) {
        LOGGER.info("[GROUP_INVITE] decline inviteId={} userId={}", inviteId, userId);
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (userId == null) {
            throw new IllegalArgumentException(Constantes.KEY_USER_ID + " es obligatorio");
        }
        if (!Objects.equals(authenticatedUserId, userId)) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }

        GroupInviteEntity inv = inviteRepo.findById(inviteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_INVITACION_NO_EXISTE + inviteId));
        if (!Objects.equals(inv.getInvitee().getId(), authenticatedUserId)) {
            throw new AccessDeniedException(ExceptionConstants.ERROR_INVITE_NOT_FOR_USER);
        }

        if (inv.getStatus() != InviteStatus.PENDING) {
            throw new IllegalArgumentException(Constantes.MSG_INVITACION_YA_RESUELTA);
        }

        inv.setStatus(InviteStatus.DECLINED);
        inv.setRespondedAt(LocalDateTime.now());
        inviteRepo.save(inv);

        GroupInviteResponseWS ws = new GroupInviteResponseWS();
        ws.setInviteId(inv.getId());
        ws.setGroupId(inv.getChat().getId());
        ws.setGroupName(inv.getChat().getNombreGrupo());
        ws.setInviteeId(inv.getInvitee().getId());
        ws.setInviteeNombre(inv.getInvitee().getNombre());
        ws.setStatus(InviteStatus.DECLINED);

        NotificationEntity notif = new NotificationEntity();
        notif.setUserId(inv.getInviter().getId());
        notif.setType(NotificationType.GROUP_INVITE_RESPONSE);
        notif.setPayloadJson(Utils.writeJson(ws));
        notif.setSeen(false);
        notificationRepo.save(notif);

        int unseenForCreator = (int) notificationRepo.countByUserIdAndSeenFalse(inv.getInviter().getId());
        ws.setUnseenCount(unseenForCreator);
        Utils.sendNotif(messagingTemplate, inv.getInviter().getId(), ws);

        notificationRepo.findFirstByUserIdAndTypeAndPayloadJsonContaining(
                authenticatedUserId, NotificationType.GROUP_INVITE, "\"inviteId\":" + inviteId).ifPresent(n -> {
                    n.setSeen(true);
                    n.setResolved(true);
                    notificationRepo.save(n);
                });

        int unseenForInvitee = (int) notificationRepo.countByUserIdAndSeenFalse(authenticatedUserId);
        Utils.sendNotif(messagingTemplate, authenticatedUserId, new UnseenCountWS(authenticatedUserId, unseenForInvitee));
    }
}
