package com.chat.chat.Repository;

import com.chat.chat.Entity.EncuestaOpcionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EncuestaOpcionRepository extends JpaRepository<EncuestaOpcionEntity, Long> {

    List<EncuestaOpcionEntity> findByEncuestaIdOrderByOrderIndexAscIdAsc(Long encuestaId);

    List<EncuestaOpcionEntity> findByEncuestaIdInOrderByEncuestaIdAscOrderIndexAscIdAsc(List<Long> encuestaIds);

    Optional<EncuestaOpcionEntity> findByEncuestaIdAndOptionKey(Long encuestaId, String optionKey);

    Optional<EncuestaOpcionEntity> findByIdAndEncuestaId(Long id, Long encuestaId);
}
