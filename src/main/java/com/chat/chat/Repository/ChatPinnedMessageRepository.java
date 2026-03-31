package com.chat.chat.Repository;

import com.chat.chat.Entity.ChatPinnedMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface ChatPinnedMessageRepository extends JpaRepository<ChatPinnedMessageEntity, Long> {

    Optional<ChatPinnedMessageEntity> findByChatId(Long chatId);

    Optional<ChatPinnedMessageEntity> findByChatIdAndActivoTrueAndUnpinnedAtIsNullAndExpiresAtAfter(Long chatId, LocalDateTime now);
}
