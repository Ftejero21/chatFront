package com.chat.chat.Repository;

import com.chat.chat.Entity.MensajeReaccionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface MensajeReaccionRepository extends JpaRepository<MensajeReaccionEntity, Long> {
    Optional<MensajeReaccionEntity> findByMensajeIdAndUsuarioId(Long mensajeId, Long usuarioId);

    void deleteByMensajeIdAndUsuarioId(Long mensajeId, Long usuarioId);

    Optional<MensajeReaccionEntity> findTopByMensajeIdOrderByUpdatedAtDescIdDesc(Long mensajeId);

    List<MensajeReaccionEntity> findByMensajeIdOrderByUpdatedAtDesc(Long mensajeId);

    List<MensajeReaccionEntity> findByMensajeIdInOrderByMensajeIdAscUpdatedAtDescIdDesc(List<Long> mensajeIds);

    @Transactional
    long deleteByMensajeIdIn(List<Long> mensajeIds);
}
