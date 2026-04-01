package com.chat.chat.Service.MensajeriaService;

import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MensajeReaccionDTO;
import com.chat.chat.DTO.MensajesDestacadosPageDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;

import java.util.List;
import java.util.Set;

public interface MensajeriaService {
    MensajeDTO guardarMensajeIndividual(MensajeDTO dto);
    MensajeDTO guardarMensajeGrupal(MensajeDTO dto);
    MensajeDTO editarMensajePropio(MensajeDTO dto);
    MensajeDTO votarEncuesta(VotoEncuestaDTO request);
    ReactionDispatchResult procesarReaccion(MensajeReaccionDTO request);

    void marcarMensajesComoLeidos(List<Long> ids);
    void destacarMensaje(Long mensajeId);
    void quitarDestacado(Long mensajeId);
    MensajesDestacadosPageDTO listarMensajesDestacadosUsuario(Integer page, Integer size, String sort);

    public boolean eliminarMensajePropio(MensajeDTO mensajeDTO);
    MensajeDTO eliminarMensajePropio(Long mensajeId, String motivoEliminacion);
    MensajeDTO restaurarMensajePropio(Long mensajeId);

    record ReactionDispatchResult(
            MensajeReaccionDTO event,
            Set<Long> recipientUserIds,
            Long chatId,
            boolean groupChat
    ) {
    }
}
