package com.chat.chat.Controller;

import com.chat.chat.DTO.MensajesDestacadosPageDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Service.MensajeriaService.MensajeriaService;
import com.chat.chat.Utils.Constantes;
import jakarta.servlet.http.HttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(Constantes.API_MENSAJES)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Mensajes Destacados", description = "Gestion de destacados por usuario autenticado.")
public class MensajeDestacadoController {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajeDestacadoController.class);

    @Autowired
    private MensajeriaService mensajeriaService;

    @PostMapping(Constantes.MENSAJE_DESTACAR)
    @Operation(summary = "Destacar mensaje", description = "Marca un mensaje como destacado para el usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operación idempotente aplicada"),
            @ApiResponse(responseCode = "403", description = "Sin permisos sobre el mensaje/chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> destacarMensaje(@PathVariable("mensajeId") Long mensajeId,
                                                HttpServletRequest request) {
        logInbound("DESTACAR", request, "mensajeId=" + mensajeId);
        mensajeriaService.destacarMensaje(mensajeId);
        LOGGER.info("[DESTACADOS_CTRL] op=DESTACAR status=OK traceId={} mensajeId={}",
                resolveTraceId(request),
                mensajeId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping(Constantes.MENSAJE_DESTACAR)
    @Operation(summary = "Quitar destacado", description = "Elimina el destacado de un mensaje para el usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Operación idempotente aplicada"),
            @ApiResponse(responseCode = "403", description = "Sin permisos sobre el mensaje/chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> quitarDestacado(@PathVariable("mensajeId") Long mensajeId,
                                                HttpServletRequest request) {
        logInbound("QUITAR", request, "mensajeId=" + mensajeId);
        mensajeriaService.quitarDestacado(mensajeId);
        LOGGER.info("[DESTACADOS_CTRL] op=QUITAR status=OK traceId={} mensajeId={}",
                resolveTraceId(request),
                mensajeId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(Constantes.MENSAJES_DESTACADOS)
    @Operation(summary = "Listar destacados", description = "Devuelve la lista paginada de mensajes destacados del usuario autenticado.")
    @ApiResponse(responseCode = "200", description = "Destacados obtenidos")
    public ResponseEntity<MensajesDestacadosPageDTO> listarDestacados(
            @RequestParam(value = "page", defaultValue = "0") Integer page,
            @RequestParam(value = "size", defaultValue = "10") Integer size,
            @RequestParam(value = "sort", required = false) String sort,
            HttpServletRequest request) {
        logInbound("LISTAR", request, "page=" + page + " size=" + size + " sort=" + sort);
        return ResponseEntity.ok(mensajeriaService.listarMensajesDestacadosUsuario(page, size, sort));
    }

    private void logInbound(String op, HttpServletRequest request, String extra) {
        boolean hasAuthHeader = request != null && request.getHeader(Constantes.HEADER_AUTHORIZATION) != null;
        String authPreview = hasAuthHeader
                ? maskAuthHeader(request.getHeader(Constantes.HEADER_AUTHORIZATION))
                : "NONE";
        LOGGER.info("[DESTACADOS_CTRL] op={} stage=INBOUND traceId={} uri={} method={} hasAuthHeader={} auth={} {}",
                op,
                resolveTraceId(request),
                request == null ? null : request.getRequestURI(),
                request == null ? null : request.getMethod(),
                hasAuthHeader,
                authPreview,
                extra);
    }

    private String resolveTraceId(HttpServletRequest request) {
        if (request == null) {
            return "no-request";
        }
        Object attr = request.getAttribute("security.trace.id");
        if (attr instanceof String value && !value.isBlank()) {
            return value;
        }
        String header = request.getHeader("X-Trace-Id");
        return (header == null || header.isBlank()) ? "no-trace" : header;
    }

    private String maskAuthHeader(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            return "NONE";
        }
        String normalized = authHeader.trim();
        int keep = Math.min(18, normalized.length());
        return normalized.substring(0, keep) + "...";
    }
}
