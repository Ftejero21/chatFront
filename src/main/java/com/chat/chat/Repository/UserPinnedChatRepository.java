package com.chat.chat.Repository;

import com.chat.chat.Entity.UserPinnedChatEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserPinnedChatRepository extends JpaRepository<UserPinnedChatEntity, Long> {
}
