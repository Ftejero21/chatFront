package com.chat.chat.Repository;

import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatIndividualRepository extends JpaRepository<ChatIndividualEntity, Long> {
    List<ChatIndividualEntity> findAllByUsuario1IdOrUsuario2Id(Long usuario1Id, Long usuario2Id);
    Optional<ChatIndividualEntity> findByUsuario1AndUsuario2(UsuarioEntity u1, UsuarioEntity u2);
    Optional<ChatIndividualEntity> findFirstByUsuario1AndUsuario2OrderByIdAsc(UsuarioEntity u1, UsuarioEntity u2);

}
