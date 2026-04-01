package com.chat.chat.Repository;

import com.chat.chat.Entity.MensajeDestacadoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MensajeDestacadoRepository extends JpaRepository<MensajeDestacadoEntity, Long> {

    boolean existsByUsuarioIdAndMensajeId(Long usuarioId, Long mensajeId);

    long deleteByUsuarioIdAndMensajeId(Long usuarioId, Long mensajeId);

    interface DestacadoRow {
        Long getMensajeId();
        Long getChatId();
        Long getEmisorId();
        String getTipoMensaje();
        String getContenido();
        String getMediaUrl();
        Integer getMediaDuracionMs();
        Long getMediaSizeBytes();
        java.time.LocalDateTime getFechaMensaje();
        java.time.LocalDateTime getDestacadoEn();
        String getEmisorNombre();
        String getEmisorApellido();
        String getNombreGrupo();
        Boolean getMensajeTemporal();
        Long getMensajeTemporalSegundos();
        java.time.LocalDateTime getExpiraEn();
        Boolean getActivo();
        String getMotivoEliminacion();
        String getPlaceholderTexto();
    }

    @Query(
            value = "select " +
                    "m.id as mensajeId, " +
                    "m.chat_id as chatId, " +
                    "m.emisor_id as emisorId, " +
                    "m.tipo as tipoMensaje, " +
                    "m.contenido as contenido, " +
                    "m.media_url as mediaUrl, " +
                    "m.media_duracion_ms as mediaDuracionMs, " +
                    "m.media_size_bytes as mediaSizeBytes, " +
                    "m.fecha_envio as fechaMensaje, " +
                    "md.created_at as destacadoEn, " +
                    "u.nombre as emisorNombre, " +
                    "u.apellido as emisorApellido, " +
                    "(select cg.nombre_grupo from chats_grupales cg where cg.id = m.chat_id) as nombreGrupo, " +
                    "m.mensaje_temporal as mensajeTemporal, " +
                    "m.mensaje_temporal_segundos as mensajeTemporalSegundos, " +
                    "m.expira_en as expiraEn, " +
                    "m.activo as activo, " +
                    "m.motivo_eliminacion as motivoEliminacion, " +
                    "m.placeholder_texto as placeholderTexto " +
                    "from mensaje_destacado md " +
                    "join mensajes m on m.id = md.mensaje_id " +
                    "left join usuarios u on u.id = m.emisor_id " +
                    "where md.usuario_id = :usuarioId " +
                    "and (exists (select 1 from chats_individuales ci where ci.id = m.chat_id) " +
                    "     or exists (select 1 from chats_grupales cg where cg.id = m.chat_id)) " +
                    "order by coalesce(m.fecha_envio, md.created_at) desc, md.created_at desc, md.id desc",
            countQuery = "select count(1) " +
                    "from mensaje_destacado md " +
                    "join mensajes m on m.id = md.mensaje_id " +
                    "where md.usuario_id = :usuarioId " +
                    "and (exists (select 1 from chats_individuales ci where ci.id = m.chat_id) " +
                    "     or exists (select 1 from chats_grupales cg where cg.id = m.chat_id))",
            nativeQuery = true
    )
    Page<DestacadoRow> findDestacadosRowsByUsuarioId(
            @Param("usuarioId") Long usuarioId,
            Pageable pageable
    );
}
