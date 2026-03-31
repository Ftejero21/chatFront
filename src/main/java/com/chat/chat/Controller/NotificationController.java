package com.chat.chat.Controller;

import com.chat.chat.DTO.NotificationDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Service.NotificacionService.NotificationService;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(Constantes.API_NOTIFICATIONS)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Notificaciones", description = "Consulta y resolucion de notificaciones de usuario.")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @GetMapping(Constantes.NOTIFICACIONES_COUNT)
    @Operation(summary = "Contar no vistas", description = "Devuelve el total de notificaciones no vistas para un usuario.")
    @ApiResponse(responseCode = "200", description = "Conteo obtenido")
    public Map<String, Object> unseenCount(@Parameter(description = "ID del usuario (opcional; se ignora y se usa JWT)") @RequestParam(value = Constantes.KEY_USER_ID, required = false) Long userId) {
        long count = notificationService.unseenCount(null);
        return Map.of(Constantes.KEY_UNSEEN_COUNT, count);
    }

    @GetMapping(Constantes.NOTIFICACIONES_PENDIENTES)
    @Operation(summary = "Listar pendientes", description = "Devuelve notificaciones pendientes de resolver para un usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Listado obtenido"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public List<NotificationDTO> listPending(@PathVariable("userId") Long userId) {
        return notificationService.listPending(null);
    }

    @PostMapping(Constantes.NOTIFICACIONES_RESOLVER)
    @Operation(summary = "Resolver notificacion", description = "Marca una notificacion como resuelta para un usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Notificacion resuelta"),
            @ApiResponse(responseCode = "404", description = "Notificacion no encontrada", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void resolve(
            @PathVariable("notifId") Long notifId,
            @Parameter(description = "ID del usuario propietario (opcional; se ignora y se usa JWT)") @RequestParam(value = Constantes.KEY_USER_ID, required = false) Long userId) {
        notificationService.resolve(null, notifId);
    }

    @GetMapping
    @Operation(summary = "Listar notificaciones", description = "Devuelve todas las notificaciones de un usuario.")
    @ApiResponse(responseCode = "200", description = "Listado obtenido")
    public List<NotificationDTO> list(@RequestParam(value = Constantes.KEY_USER_ID, required = false) Long userId) {
        return notificationService.list(null);
    }

    @PostMapping(Constantes.NOTIFICACIONES_VISTA)
    @Operation(summary = "Marcar notificacion vista", description = "Marca una notificacion especifica como vista.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Notificacion actualizada"),
            @ApiResponse(responseCode = "404", description = "Notificacion no encontrada", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void markSeen(@RequestParam(value = Constantes.KEY_USER_ID, required = false) Long userId, @PathVariable("id") Long id) {
        notificationService.markSeen(null, id);
    }

    @PostMapping(Constantes.NOTIFICACIONES_VISTAS_TODAS)
    @Operation(summary = "Marcar todas como vistas", description = "Marca como vistas todas las notificaciones de un usuario.")
    @ApiResponse(responseCode = "200", description = "Notificaciones actualizadas")
    public void markAllSeen(@RequestParam(value = Constantes.KEY_USER_ID, required = false) Long userId) {
        notificationService.markAllSeen(null);
    }
}
