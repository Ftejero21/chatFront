package com.chat.chat.Repository;

import com.chat.chat.Entity.ChatUserStateEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatUserStateRepository extends JpaRepository<ChatUserStateEntity, Long> {

    Optional<ChatUserStateEntity> findByChat_IdAndUser_Id(Long chatId, Long userId);

    List<ChatUserStateEntity> findByUser_IdAndChat_IdIn(Long userId, Collection<Long> chatIds);

    @Query("select s from ChatUserStateEntity s " +
            "where s.user.id = :userId " +
            "and (s.mutedForever = true or (s.mutedUntil is not null and s.mutedUntil > :now))")
    List<ChatUserStateEntity> findActiveMutesByUser(@Param("userId") Long userId,
                                                     @Param("now") java.time.LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ChatUserStateEntity s where s.chat.id = :chatId and s.user.id = :userId")
    Optional<ChatUserStateEntity> findByChatIdAndUserIdForUpdate(@Param("chatId") Long chatId,
                                                                  @Param("userId") Long userId);
}
