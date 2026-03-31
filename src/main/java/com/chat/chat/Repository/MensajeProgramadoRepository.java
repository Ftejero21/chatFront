package com.chat.chat.Repository;

import com.chat.chat.Entity.MensajeProgramadoEntity;
import com.chat.chat.Utils.EstadoMensajeProgramado;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MensajeProgramadoRepository extends JpaRepository<MensajeProgramadoEntity, Long> {

    List<MensajeProgramadoEntity> findByCreatedByIdOrderByCreatedAtDesc(Long createdById);

    List<MensajeProgramadoEntity> findByCreatedByIdAndStatusOrderByCreatedAtDesc(Long createdById,
                                                                                  EstadoMensajeProgramado status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MensajeProgramadoEntity m where m.id = :id")
    Optional<MensajeProgramadoEntity> findByIdForUpdate(@Param("id") Long id);
}
