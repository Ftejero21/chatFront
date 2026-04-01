package com.chat.chat.Repository;

import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.GroupInviteEntity;
import com.chat.chat.Utils.InviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatRepository extends JpaRepository<ChatEntity, Long> {

    @Query("SELECT COUNT(c) FROM ChatEntity c WHERE c.fechaCreacion >= :inicio AND c.fechaCreacion < :fin")
    long countChatsEntreFechas(@Param("inicio") java.time.LocalDateTime inicio,
            @Param("fin") java.time.LocalDateTime fin);
}
