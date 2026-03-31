package com.chat.chat.Mapper;

import com.chat.chat.DTO.GroupMediaItemDTO;
import com.chat.chat.Entity.MensajeEntity;
import org.springframework.stereotype.Component;

@Component
public class GroupMediaItemMapper {

    public GroupMediaItemDTO toDto(MensajeEntity mensaje, String emisorNombreCompleto, GroupMediaMeta meta) {
        GroupMediaItemDTO dto = new GroupMediaItemDTO();
        dto.setMessageId(mensaje.getId());
        dto.setChatId(mensaje.getChat() == null ? null : mensaje.getChat().getId());
        dto.setEmisorId(mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId());
        dto.setEmisorNombreCompleto(emisorNombreCompleto);
        dto.setTipo(mensaje.getTipo() == null ? null : mensaje.getTipo().name());
        dto.setFechaEnvio(mensaje.getFechaEnvio());
        dto.setActivo(mensaje.isActivo());
        dto.setReenviado(mensaje.isReenviado());
        dto.setContenidoRaw(mensaje.getContenido());

        if (meta != null) {
            dto.setMime(meta.mime());
            dto.setDurMs(meta.durMs());
            dto.setMediaUrl(meta.mediaUrl());
            dto.setFileName(meta.fileName());
            dto.setSizeBytes(meta.sizeBytes());
        }
        return dto;
    }
}
