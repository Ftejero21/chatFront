package com.chat.chat.Service.NotificacionService;

import com.chat.chat.DTO.NotificationDTO;

import java.util.List;

public interface NotificationService {

    long unseenCount(Long userId);
    List<NotificationDTO> list(Long userId);
    void markSeen(Long userId, Long notificationId);
    void markAllSeen(Long userId);

    void resolve(Long userId, Long notificationId);
    List<NotificationDTO> listPending(Long userId);
}
