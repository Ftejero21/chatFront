package com.chat.chat.Service.EncuestaService;

import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;

import java.util.List;

public interface EncuestaService {
    boolean esMensajeEncuesta(MensajeDTO dto);

    void normalizarPayloadEncuesta(MensajeDTO dto);

    void crearEncuestaParaMensaje(MensajeEntity mensaje, MensajeDTO dto, UsuarioEntity creador);

    void enriquecerMensajesConEncuesta(List<MensajeEntity> mensajes,
                                       List<MensajeDTO> mensajesDto,
                                       Long usuarioId,
                                       boolean incluirIdsVotantes);

    MensajeDTO votarEncuesta(VotoEncuestaDTO solicitud, Long usuarioId);
}
