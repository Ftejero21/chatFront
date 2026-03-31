package com.chat.chat.Service.SolicitudDesbaneoService;

import com.chat.chat.DTO.SolicitudDesbaneoCreateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoCreateResponseDTO;
import com.chat.chat.DTO.SolicitudDesbaneoDTO;
import com.chat.chat.DTO.SolicitudDesbaneoEstadoUpdateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoStatsDTO;
import org.springframework.data.domain.Page;

public interface SolicitudDesbaneoService {
    SolicitudDesbaneoCreateResponseDTO crearSolicitud(SolicitudDesbaneoCreateDTO request);

    Page<SolicitudDesbaneoDTO> listarSolicitudes(String estado, String estados, Integer page, Integer size, String sort);

    SolicitudDesbaneoDTO obtenerSolicitud(Long id);

    SolicitudDesbaneoDTO actualizarEstado(Long id, SolicitudDesbaneoEstadoUpdateDTO request);

    SolicitudDesbaneoStatsDTO obtenerStats();
    SolicitudDesbaneoStatsDTO obtenerStats(String tz);
}
