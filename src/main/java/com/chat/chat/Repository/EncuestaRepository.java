package com.chat.chat.Repository;

import com.chat.chat.Entity.EncuestaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

@Repository
public interface EncuestaRepository extends JpaRepository<EncuestaEntity, Long> {

    Optional<EncuestaEntity> findByMensajeId(Long mensajeId);

    List<EncuestaEntity> findByMensajeIdIn(List<Long> mensajeIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EncuestaEntity e where e.mensaje.id = :mensajeId")
    Optional<EncuestaEntity> findByMensajeIdForUpdate(@Param("mensajeId") Long mensajeId);
}
