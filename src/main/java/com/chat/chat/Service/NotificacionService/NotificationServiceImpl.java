package com.chat.chat.Service.NotificacionService;

import com.chat.chat.DTO.NotificationDTO;
import com.chat.chat.DTO.UnseenCountWS;
import com.chat.chat.Entity.NotificationEntity;
import com.chat.chat.Repository.NotificationRepo;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.SecurityUtils;
import com.chat.chat.Utils.Utils;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationServiceImpl.class);

    @Autowired
    private NotificationRepo notificationRepo;
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private SecurityUtils securityUtils;

    @Override
    public long unseenCount(Long userId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] unseenCount userId={}", effectiveUserId);
        return notificationRepo.countByUserIdAndSeenFalse(effectiveUserId);
    }

    @Override
    public List<NotificationDTO> list(Long userId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] list userId={}", effectiveUserId);
        return MappingUtils.notificationEntityListADto(
                notificationRepo.findByUserIdOrderByCreatedAtDesc(effectiveUserId));
    }

    @Override
    @Transactional
    public void markSeen(Long userId, Long notificationId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] markSeen userId={} notificationId={}", effectiveUserId, notificationId);
        NotificationEntity n = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException(Constantes.MSG_NOTIFICACION_NO_EXISTE + notificationId));
        if (!Objects.equals(n.getUserId(), effectiveUserId)) {
            throw new IllegalArgumentException(ExceptionConstants.ERROR_NOT_AUTHORIZED_MARK);
        }

        n.setSeen(true);
        notificationRepo.save(n);

        int count = (int) notificationRepo.countByUserIdAndSeenFalse(effectiveUserId);
        Utils.sendNotif(messagingTemplate, effectiveUserId, new UnseenCountWS(effectiveUserId, count));
    }

    @Override
    @Transactional
    public void markAllSeen(Long userId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] markAllSeen userId={}", effectiveUserId);
        // notificationRepo.markAllSeenByUserId(userId); // opcion eficiente
        List<NotificationEntity> list = notificationRepo.findByUserIdOrderByCreatedAtDesc(effectiveUserId);
        list.forEach(n -> n.setSeen(true));
        notificationRepo.saveAll(list);

        int count = (int) notificationRepo.countByUserIdAndSeenFalse(effectiveUserId);
        Utils.sendNotif(messagingTemplate, effectiveUserId, new UnseenCountWS(effectiveUserId, count));
    }

    @Override
    public List<NotificationDTO> listPending(Long userId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] listPending userId={}", effectiveUserId);
        return MappingUtils.notificationEntityListADto(
                notificationRepo.findByUserIdAndResolvedFalseOrderByCreatedAtDesc(effectiveUserId));
    }

    @Override
    @Transactional
    public void resolve(Long userId, Long notificationId) {
        Long effectiveUserId = resolveEffectiveUserId(userId);
        LOGGER.info("[NOTIFICATION] resolve userId={} notificationId={}", effectiveUserId, notificationId);
        NotificationEntity n = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException(Constantes.MSG_NOTIFICACION_NO_EXISTE + notificationId));
        if (!Objects.equals(n.getUserId(), effectiveUserId)) {
            throw new IllegalArgumentException(ExceptionConstants.ERROR_NOT_AUTHORIZED_RESOLVE);
        }

        n.setResolved(true);
        notificationRepo.save(n);
    }

    private Long resolveEffectiveUserId(Long requestedUserId) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (requestedUserId != null && !Objects.equals(requestedUserId, authenticatedUserId)) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }
        return authenticatedUserId;
    }
}
