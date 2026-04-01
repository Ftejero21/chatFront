package com.chat.chat.Controller;

import com.chat.chat.DTO.GroupInviteCreateDTO;
import com.chat.chat.DTO.GroupInviteWS;
import com.chat.chat.DTO.InviteDecisionDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Service.GroupInviteService.GroupInviteService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(Constantes.API_GROUP_INVITES)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Invitaciones de Grupo", description = "Creacion y decision de invitaciones para grupos.")
public class GroupInviteController {

    @Autowired
    private GroupInviteService groupInviteService;

    @Autowired
    private SecurityUtils securityUtils;

    @PostMapping
    @Operation(summary = "Crear invitacion", description = "Genera una invitacion para que un usuario se una a un grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Invitacion creada", content = @Content(schema = @Schema(implementation = GroupInviteWS.class))),
            @ApiResponse(responseCode = "400", description = "Datos invalidos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Invitacion duplicada o estado invalido", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<GroupInviteWS> create(@RequestBody GroupInviteCreateDTO body) {
        GroupInviteWS created = groupInviteService.create(
                body == null ? null : body.getGroupId(),
                body == null ? null : body.getInviteeId(),
                securityUtils.getAuthenticatedUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(Constantes.GROUP_INVITE_ACCEPT)
    @Operation(summary = "Aceptar invitacion", description = "Acepta una invitacion pendiente y agrega el usuario al grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Invitacion aceptada"),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Invitacion no encontrada", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void accept(
            @Parameter(description = "ID de invitacion") @PathVariable("inviteId") Long inviteId,
            @RequestBody InviteDecisionDTO body) {
        groupInviteService.accept(inviteId, body == null ? null : body.getUserId());
    }

    @PostMapping(Constantes.GROUP_INVITE_DECLINE)
    @Operation(summary = "Rechazar invitacion", description = "Rechaza una invitacion pendiente sin agregar al usuario al grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Invitacion rechazada"),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Invitacion no encontrada", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void decline(
            @Parameter(description = "ID de invitacion") @PathVariable("inviteId") Long inviteId,
            @RequestBody InviteDecisionDTO body) {
        groupInviteService.decline(inviteId, body == null ? null : body.getUserId());
    }
}
