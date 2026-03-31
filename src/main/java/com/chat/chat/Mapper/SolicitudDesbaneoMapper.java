package com.chat.chat.Mapper;

import com.chat.chat.DTO.SolicitudDesbaneoDTO;
import com.chat.chat.DTO.SolicitudDesbaneoWsDTO;
import com.chat.chat.Entity.SolicitudDesbaneoEntity;
import com.chat.chat.Entity.UsuarioEntity;
import org.springframework.stereotype.Component;

@Component
public class SolicitudDesbaneoMapper {

    public SolicitudDesbaneoDTO toDto(SolicitudDesbaneoEntity entity, UsuarioEntity usuario) {
        SolicitudDesbaneoDTO dto = new SolicitudDesbaneoDTO();
        dto.setId(entity.getId());
        dto.setUsuarioId(entity.getUsuarioId());
        dto.setEmail(entity.getEmail());
        dto.setMotivo(entity.getMotivo());
        dto.setEstado(entity.getEstado());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setReviewedByAdminId(entity.getReviewedByAdminId());
        dto.setResolucionMotivo(entity.getResolucionMotivo());
        if (usuario != null) {
            dto.setUsuarioNombre(usuario.getNombre());
            dto.setUsuarioApellido(usuario.getApellido());
        }
        return dto;
    }

    public SolicitudDesbaneoWsDTO toWsDto(String eventName, SolicitudDesbaneoEntity entity, UsuarioEntity usuario) {
        SolicitudDesbaneoWsDTO dto = new SolicitudDesbaneoWsDTO();
        dto.setEvent(eventName);
        dto.setId(entity.getId());
        dto.setUsuarioId(entity.getUsuarioId());
        dto.setEmail(entity.getEmail());
        dto.setMotivo(entity.getMotivo());
        dto.setEstado(entity.getEstado());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        if (usuario != null) {
            dto.setUsuarioNombre(usuario.getNombre());
            dto.setUsuarioApellido(usuario.getApellido());
        }
        return dto;
    }
}
