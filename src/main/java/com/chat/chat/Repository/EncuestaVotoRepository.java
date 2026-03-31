package com.chat.chat.Repository;

import com.chat.chat.Entity.EncuestaVotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface EncuestaVotoRepository extends JpaRepository<EncuestaVotoEntity, Long> {

    List<EncuestaVotoEntity> findByEncuestaId(Long encuestaId);

    List<EncuestaVotoEntity> findByEncuestaIdIn(List<Long> encuestaIds);

    List<EncuestaVotoEntity> findByEncuestaIdAndUsuarioId(Long encuestaId, Long usuarioId);

    Optional<EncuestaVotoEntity> findByEncuestaIdAndUsuarioIdAndOpcionId(Long encuestaId, Long usuarioId, Long opcionId);

    @Modifying
    @Transactional
    @Query("delete from EncuestaVotoEntity v where v.encuesta.id = :encuestaId and v.usuario.id = :usuarioId")
    int deleteByEncuestaIdAndUsuarioId(@Param("encuestaId") Long encuestaId, @Param("usuarioId") Long usuarioId);

    @Modifying
    @Transactional
    @Query("delete from EncuestaVotoEntity v where v.encuesta.id = :encuestaId and v.usuario.id = :usuarioId and v.opcion.id = :opcionId")
    int deleteByEncuestaIdAndUsuarioIdAndOpcionId(@Param("encuestaId") Long encuestaId,
                                                  @Param("usuarioId") Long usuarioId,
                                                  @Param("opcionId") Long opcionId);

    @Query("select v.opcion.id, count(v) from EncuestaVotoEntity v where v.encuesta.id = :encuestaId group by v.opcion.id")
    List<Object[]> countByEncuestaGroupedByOpcion(@Param("encuestaId") Long encuestaId);
}
