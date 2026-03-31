package com.chat.chat.Repository;

import com.chat.chat.Entity.ChatGrupalEntity;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatGrupalRepository extends JpaRepository<ChatGrupalEntity, Long> {
    List<ChatGrupalEntity> findAllByUsuariosId(Long usuarioId);

    @Query("select distinct c from ChatGrupalEntity c left join fetch c.usuarios where c.id = :id")
    Optional<ChatGrupalEntity> findByIdWithUsuarios(@Param("id") Long id);
}
