package com.chat.chat.Mapper;

import com.chat.chat.DTO.MensajeProgramadoDTO;
import com.chat.chat.DTO.ProgramarMensajeItemDTO;
import com.chat.chat.Entity.MensajeProgramadoEntity;
import org.springframework.stereotype.Component;

@Component
public class MensajeProgramadoMapper {

    public ProgramarMensajeItemDTO toProgramarMensajeItemDto(MensajeProgramadoEntity entity) {
        ProgramarMensajeItemDTO item = new ProgramarMensajeItemDTO();
        item.setChatId(entity.getChat() == null ? null : entity.getChat().getId());
        item.setStatus(entity.getStatus() == null ? null : entity.getStatus().name());
        item.setScheduledMessageId(entity.getId());
        return item;
    }

    public MensajeProgramadoDTO toDto(MensajeProgramadoEntity entity) {
        MensajeProgramadoDTO dto = new MensajeProgramadoDTO();
        dto.setId(entity.getId());
        dto.setCreatedBy(entity.getCreatedBy() == null ? null : entity.getCreatedBy().getId());
        dto.setChatId(entity.getChat() == null ? null : entity.getChat().getId());
        dto.setMessageContent(entity.getMessageContent());
        dto.setScheduledAt(entity.getScheduledAt());
        dto.setStatus(entity.getStatus() == null ? null : entity.getStatus().name());
        dto.setAttempts(entity.getAttempts());
        dto.setLastError(entity.getLastError());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setSentAt(entity.getSentAt());
        dto.setScheduledBatchId(entity.getScheduledBatchId());
        dto.setWsEmitted(entity.isWsEmitted());
        dto.setWsEmittedAt(entity.getWsEmittedAt());
        dto.setWsDestinations(entity.getWsDestinations());
        dto.setWsEmitError(entity.getWsEmitError());
        dto.setPersistedMessageId(entity.getPersistedMessageId());
        return dto;
    }
}
