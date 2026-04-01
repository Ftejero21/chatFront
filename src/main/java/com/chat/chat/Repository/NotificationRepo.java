package com.chat.chat.Repository;

import com.chat.chat.Entity.NotificationEntity;
import com.chat.chat.Utils.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepo extends JpaRepository<NotificationEntity, Long> {
    long countByUserIdAndSeenFalse(Long userId);
    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<NotificationEntity> findByUserIdAndResolvedFalseOrderByCreatedAtDesc(Long userId);

    // Para encontrar la notificación de invitación concreta (buscamos por inviteId en el JSON)
    Optional<NotificationEntity> findFirstByUserIdAndTypeAndPayloadJsonContaining(
            Long userId, NotificationType type, String token);

    long countBySeenTrueAndResolvedTrueAndCreatedAtBefore(LocalDateTime cutoff);

    @Query("select n.id from NotificationEntity n " +
            "where n.seen = true and n.resolved = true and n.createdAt < :cutoff")
    List<Long> findIdsForCleanup(@Param("cutoff") LocalDateTime cutoff, Pageable pageable);
}
