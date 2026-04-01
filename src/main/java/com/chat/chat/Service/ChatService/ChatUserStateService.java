package com.chat.chat.Service.ChatService;

import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatUserStateEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatUserStateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ChatUserStateService {

    @Autowired
    private ChatUserStateRepository chatUserStateRepository;

    @Transactional(readOnly = true)
    public Long resolveCutoff(Long chatId, Long userId) {
        if (chatId == null || userId == null) {
            return null;
        }
        return chatUserStateRepository.findByChat_IdAndUser_Id(chatId, userId)
                .map(ChatUserStateEntity::getClearedBeforeMessageId)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<Long, Long> resolveCutoffs(Long userId, Collection<Long> chatIds) {
        if (userId == null || chatIds == null || chatIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> byChatId = new LinkedHashMap<>();
        chatUserStateRepository.findByUser_IdAndChat_IdIn(userId, chatIds)
                .forEach(state -> {
                    if (state == null || state.getChat() == null || state.getChat().getId() == null) {
                        return;
                    }
                    byChatId.put(state.getChat().getId(), state.getClearedBeforeMessageId());
                });
        return byChatId;
    }

    @Transactional(readOnly = true)
    public Map<Long, Boolean> resolveVisibility(Long userId, Collection<Long> chatIds) {
        if (userId == null || chatIds == null || chatIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Boolean> byChatId = new LinkedHashMap<>();
        chatUserStateRepository.findByUser_IdAndChat_IdIn(userId, chatIds)
                .forEach(state -> {
                    if (state == null || state.getChat() == null || state.getChat().getId() == null) {
                        return;
                    }
                    byChatId.put(state.getChat().getId(), state.isActivo());
                });
        return byChatId;
    }

    @Transactional(readOnly = true)
    public boolean isChatVisible(Long chatId, Long userId) {
        if (chatId == null || userId == null) {
            return false;
        }
        return chatUserStateRepository.findByChat_IdAndUser_Id(chatId, userId)
                .map(ChatUserStateEntity::isActivo)
                .orElse(true);
    }

    @Transactional(readOnly = true)
    public List<ChatUserStateEntity> findActiveMutesByUser(Long userId, LocalDateTime now) {
        if (userId == null) {
            return List.of();
        }
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now(ZoneOffset.UTC) : now;
        return chatUserStateRepository.findActiveMutesByUser(userId, effectiveNow);
    }

    public boolean isMuteActive(ChatUserStateEntity state, LocalDateTime now) {
        if (state == null) {
            return false;
        }
        if (state.isMutedForever()) {
            return true;
        }
        LocalDateTime mutedUntil = state.getMutedUntil();
        if (mutedUntil == null) {
            return false;
        }
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now(ZoneOffset.UTC) : now;
        return mutedUntil.isAfter(effectiveNow);
    }

    @Transactional
    public ChatUserStateEntity upsertClearState(ChatEntity chat,
                                                UsuarioEntity user,
                                                Long candidateCutoff,
                                                LocalDateTime clearedAt) {
        validateChatAndUser(chat, user);
        LocalDateTime effectiveClearedAt = clearedAt == null ? LocalDateTime.now(ZoneOffset.UTC) : clearedAt;

        ChatUserStateEntity state = findOrCreateForUpdate(chat, user);
        promoteAndStamp(state, candidateCutoff, effectiveClearedAt);
        return chatUserStateRepository.save(state);
    }

    @Transactional
    public ChatUserStateEntity upsertMuteState(ChatEntity chat,
                                               UsuarioEntity user,
                                               boolean mutedForever,
                                               LocalDateTime mutedUntil,
                                               LocalDateTime now) {
        validateChatAndUser(chat, user);
        ChatUserStateEntity state = findOrCreateForUpdate(chat, user);
        state.setMutedForever(mutedForever);
        state.setMutedUntil(mutedForever ? null : mutedUntil);
        state.setUpdatedAt(now == null ? LocalDateTime.now(ZoneOffset.UTC) : now);
        return chatUserStateRepository.save(state);
    }

    @Transactional
    public ChatUserStateEntity clearMuteState(ChatEntity chat,
                                              UsuarioEntity user,
                                              LocalDateTime now) {
        validateChatAndUser(chat, user);
        ChatUserStateEntity state = findOrCreateForUpdate(chat, user);
        state.setMutedForever(false);
        state.setMutedUntil(null);
        state.setUpdatedAt(now == null ? LocalDateTime.now(ZoneOffset.UTC) : now);
        return chatUserStateRepository.save(state);
    }

    @Transactional
    public ChatUserStateEntity hideChat(ChatEntity chat, UsuarioEntity user, LocalDateTime now) {
        validateChatAndUser(chat, user);
        ChatUserStateEntity state = findOrCreateForUpdate(chat, user);
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now(ZoneOffset.UTC) : now;
        state.setActivo(false);
        state.setHiddenAt(effectiveNow);
        state.setUpdatedAt(effectiveNow);
        return chatUserStateRepository.save(state);
    }

    @Transactional
    public ChatUserStateEntity reactivateChat(ChatEntity chat, UsuarioEntity user, LocalDateTime now) {
        validateChatAndUser(chat, user);
        ChatUserStateEntity state = findOrCreateForUpdate(chat, user);
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now(ZoneOffset.UTC) : now;
        state.setActivo(true);
        state.setHiddenAt(null);
        state.setUpdatedAt(effectiveNow);
        return chatUserStateRepository.save(state);
    }

    private void promoteAndStamp(ChatUserStateEntity state, Long candidateCutoff, LocalDateTime clearedAt) {
        Long current = state.getClearedBeforeMessageId();
        Long promoted = maxNullable(current, candidateCutoff);
        if (!Objects.equals(current, promoted)) {
            state.setClearedBeforeMessageId(promoted);
        }
        state.setClearedAt(clearedAt);
    }

    private Long maxNullable(Long left, Long right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return Math.max(left, right);
    }

    private void validateChatAndUser(ChatEntity chat, UsuarioEntity user) {
        if (chat == null || chat.getId() == null) {
            throw new IllegalArgumentException("chat es obligatorio");
        }
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("user es obligatorio");
        }
    }

    private ChatUserStateEntity findOrCreateForUpdate(ChatEntity chat, UsuarioEntity user) {
        ChatUserStateEntity existing = chatUserStateRepository.findByChatIdAndUserIdForUpdate(chat.getId(), user.getId())
                .orElse(null);
        if (existing != null) {
            return existing;
        }

        ChatUserStateEntity created = new ChatUserStateEntity();
        created.setChat(chat);
        created.setUser(user);
        created.setMutedForever(false);
        created.setMutedUntil(null);
        created.setActivo(true);
        created.setHiddenAt(null);
        try {
            return chatUserStateRepository.saveAndFlush(created);
        } catch (DataIntegrityViolationException ex) {
            return chatUserStateRepository.findByChatIdAndUserIdForUpdate(chat.getId(), user.getId())
                    .orElseThrow(() -> ex);
        }
    }
}
