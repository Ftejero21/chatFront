package com.chat.chat.Repository;

import com.chat.chat.Entity.GroupInviteEntity;
import com.chat.chat.Utils.InviteStatus;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface GroupInviteRepo extends JpaRepository<GroupInviteEntity, Long> {
    long countByInviteeIdAndStatus(Long inviteeId, InviteStatus status);
    List<GroupInviteEntity> findAllByInviteeIdOrderByCreatedAtDesc(Long inviteeId);
    List<GroupInviteEntity> findAllByChatIdAndStatus(Long chatId, InviteStatus status);
    boolean existsByChatIdAndInviteeIdAndStatus(Long chatId, Long inviteeId, InviteStatus status);

    long countByStatusAndCreatedAtBefore(InviteStatus status, LocalDateTime cutoff);

    long countByStatusAndRespondedAtGreaterThanEqualAndRespondedAtLessThan(
            InviteStatus status,
            LocalDateTime from,
            LocalDateTime to
    );

    @Query("select gi.id from GroupInviteEntity gi " +
            "where gi.status = :status and gi.createdAt < :cutoff")
    List<Long> findPendingIdsForExpiration(
            @Param("status") InviteStatus status,
            @Param("cutoff") LocalDateTime cutoff,
            Pageable pageable
    );

    @Query("select gi.id from GroupInviteEntity gi " +
            "where gi.status = :status and gi.respondedAt >= :from and gi.respondedAt < :to")
    List<Long> findIdsForWeeklyCleanup(
            @Param("status") InviteStatus status,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update GroupInviteEntity gi set gi.status = :newStatus, gi.respondedAt = :respondedAt " +
            "where gi.id in :ids and gi.status = :currentStatus")
    int bulkTransitionStatusByIds(
            @Param("ids") List<Long> ids,
            @Param("currentStatus") InviteStatus currentStatus,
            @Param("newStatus") InviteStatus newStatus,
            @Param("respondedAt") LocalDateTime respondedAt
    );
}
