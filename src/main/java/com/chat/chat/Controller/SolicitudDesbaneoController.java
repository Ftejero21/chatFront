package com.chat.chat.Controller;

import com.chat.chat.DTO.SolicitudDesbaneoCreateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoCreateResponseDTO;
import com.chat.chat.DTO.SolicitudDesbaneoDTO;
import com.chat.chat.DTO.SolicitudDesbaneoEstadoUpdateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoStatsDTO;
import com.chat.chat.Security.HttpRateLimitService;
import com.chat.chat.Service.SolicitudDesbaneoService.SolicitudDesbaneoService;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping(Constantes.USUARIO_API)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Solicitudes de Desbaneo", description = "Flujo publico y administrativo de solicitudes de desbaneo.")
public class SolicitudDesbaneoController {

    private final SolicitudDesbaneoService solicitudDesbaneoService;
    private final HttpRateLimitService httpRateLimitService;

    public SolicitudDesbaneoController(SolicitudDesbaneoService solicitudDesbaneoService,
                                       HttpRateLimitService httpRateLimitService) {
        this.solicitudDesbaneoService = solicitudDesbaneoService;
        this.httpRateLimitService = httpRateLimitService;
    }

    @PostMapping(Constantes.SOLICITUD_DESBANEO_CREATE)
    @Operation(summary = "Crear solicitud de desbaneo", description = "Endpoint publico para usuarios baneados que no pueden iniciar sesion.")
    public ResponseEntity<SolicitudDesbaneoCreateResponseDTO> crearSolicitud(@RequestBody SolicitudDesbaneoCreateDTO request,
                                                                              HttpServletRequest httpRequest) {
        httpRateLimitService.checkUnbanAppeal(httpRequest, request == null ? null : request.getEmail());
        SolicitudDesbaneoCreateResponseDTO response = solicitudDesbaneoService.crearSolicitud(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping(Constantes.ADMIN_SOLICITUD_DESBANEO_LIST)
    @Operation(summary = "Listar solicitudes de desbaneo (admin)")
    public ResponseEntity<Page<SolicitudDesbaneoDTO>> listarSolicitudes(
            @Parameter(description = "Filtro opcional legacy: PENDIENTE | EN_REVISION | APROBADA | RECHAZADA")
            @RequestParam(value = "estado", required = false) String estado,
            @Parameter(description = "Filtro opcional CSV: PENDIENTE,EN_REVISION,APROBADA,RECHAZADA")
            @RequestParam(value = "estados", required = false) String estados,
            @RequestParam(value = "page", defaultValue = "0") Integer page,
            @RequestParam(value = "size", defaultValue = "20") Integer size,
            @RequestParam(value = "sort", defaultValue = "createdAt,desc") String sort) {
        return ResponseEntity.ok(solicitudDesbaneoService.listarSolicitudes(estado, estados, page, size, sort));
    }

    @GetMapping(Constantes.ADMIN_SOLICITUD_DESBANEO_STATS)
    @Operation(summary = "Estadisticas de solicitudes de desbaneo (admin)")
    public ResponseEntity<SolicitudDesbaneoStatsDTO> obtenerStats(
            @Parameter(description = "Zona horaria opcional, ejemplo: America/Bogota")
            @RequestParam(value = "tz", required = false) String tz) {
        return ResponseEntity.ok(solicitudDesbaneoService.obtenerStats(tz));
    }

    @GetMapping(Constantes.ADMIN_SOLICITUD_DESBANEO_BY_ID)
    @Operation(summary = "Detalle solicitud de desbaneo (admin)")
    public ResponseEntity<SolicitudDesbaneoDTO> obtenerSolicitud(@PathVariable("id") Long id) {
        return ResponseEntity.ok(solicitudDesbaneoService.obtenerSolicitud(id));
    }

    @PatchMapping(Constantes.ADMIN_SOLICITUD_DESBANEO_ESTADO)
    @Operation(summary = "Actualizar estado de solicitud de desbaneo (admin)")
    public ResponseEntity<SolicitudDesbaneoDTO> actualizarEstado(
            @PathVariable("id") Long id,
            @RequestBody SolicitudDesbaneoEstadoUpdateDTO request) {
        return ResponseEntity.ok(solicitudDesbaneoService.actualizarEstado(id, request));
    }
}
