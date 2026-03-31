package com.chat.chat.Service.MensajeProgramadoService;

import com.chat.chat.DTO.MensajeProgramadoDTO;
import com.chat.chat.DTO.ProgramarMensajeRequestDTO;
import com.chat.chat.DTO.ProgramarMensajeResponseDTO;
import com.chat.chat.Utils.EstadoMensajeProgramado;

import java.time.Instant;
import java.util.List;

public interface MensajeProgramadoService {
    ProgramarMensajeResponseDTO crearMensajesProgramados(ProgramarMensajeRequestDTO request);

    List<MensajeProgramadoDTO> listarMensajesProgramados(EstadoMensajeProgramado status);

    MensajeProgramadoDTO cancelarMensajeProgramado(Long id);

    List<Long> reclamarMensajesVencidos(Instant ahora, String lockToken, int limite, int lockSeconds);

    void procesarMensajeProgramado(Long id, String lockToken);
}
