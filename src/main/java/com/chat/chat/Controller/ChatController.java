package com.chat.chat.Controller;

import com.chat.chat.DTO.AddUsuariosGrupoDTO;
import com.chat.chat.DTO.AddUsuariosGrupoWSResponse;
import com.chat.chat.DTO.ChatGrupalDTO;
import com.chat.chat.DTO.ChatIndividualCreateDTO;
import com.chat.chat.DTO.ChatIndividualDTO;
import com.chat.chat.DTO.ChatClearResponseDTO;
import com.chat.chat.DTO.ChatMensajeBusquedaPageDTO;
import com.chat.chat.DTO.ChatMuteRequestDTO;
import com.chat.chat.DTO.ChatMuteStateDTO;
import com.chat.chat.DTO.ChatPinMessageRequestDTO;
import com.chat.chat.DTO.ChatPinnedMessageDTO;
import com.chat.chat.DTO.ChatResumenDTO;
import com.chat.chat.DTO.EsMiembroDTO;
import com.chat.chat.DTO.GroupDetailDTO;
import com.chat.chat.DTO.GroupMemberExpulsionResponseDTO;
import com.chat.chat.DTO.GroupMetadataUpdateDTO;
import com.chat.chat.DTO.GroupMediaPageDTO;
import com.chat.chat.DTO.LeaveGroupRequestDTO;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MensajeProgramadoDTO;
import com.chat.chat.DTO.MessagueSalirGrupoDTO;
import com.chat.chat.DTO.ProgramarMensajeRequestDTO;
import com.chat.chat.DTO.ProgramarMensajeResponseDTO;
import com.chat.chat.DTO.UserPinnedChatRequestDTO;
import com.chat.chat.DTO.UserPinnedChatResponseDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Service.ChatService.ChatService;
import com.chat.chat.Service.MensajeProgramadoService.MensajeProgramadoService;
import com.chat.chat.Service.MensajeriaService.MensajeriaService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.EstadoMensajeProgramado;
import com.chat.chat.Utils.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping(Constantes.API_CHAT)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Chats", description = "Endpoints para crear y gestionar conversaciones individuales y grupales.")
public class ChatController {

    @Autowired
    private ChatService chatService;

    @Autowired
    private MensajeriaService mensajeriaService;

    @Autowired
    private MensajeProgramadoService mensajeProgramadoService;

    @Autowired
    private SecurityUtils securityUtils;

    @PostMapping(Constantes.INDIVIDUAL)
    @Operation(summary = "Crear chat individual", description = "Crea o recupera un chat individual entre dos usuarios.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Chat individual listo", content = @Content(schema = @Schema(implementation = ChatIndividualDTO.class))),
            @ApiResponse(responseCode = "400", description = "No se puede crear chat", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ChatIndividualDTO crearChatIndividual(@RequestBody ChatIndividualCreateDTO dto) {
        return chatService.crearChatIndividual(dto.getUsuario1Id(), dto.getUsuario2Id());
    }

    @GetMapping(Constantes.GRUPAL_ES_MIEMBRO)
    @Operation(summary = "Validar membresia de grupo", description = "Indica si un usuario pertenece al grupo solicitado.")
    @ApiResponse(responseCode = "200", description = "Resultado de membresia", content = @Content(schema = @Schema(implementation = EsMiembroDTO.class)))
    public EsMiembroDTO esMiembroDeGrupo(
            @Parameter(description = "ID del grupo") @PathVariable("groupId") Long groupId,
            @Parameter(description = "ID del usuario") @PathVariable("userId") Long userId) {
        return chatService.esMiembroDeChatGrupal(groupId, userId);
    }

    @GetMapping(Constantes.GRUPAL_DETALLE)
    @Operation(summary = "Detalle de grupo", description = "Devuelve metadatos del grupo y sus miembros.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Detalle obtenido", content = @Content(schema = @Schema(implementation = GroupDetailDTO.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public GroupDetailDTO detalleGrupo(@PathVariable("groupId") Long groupId) {
        return chatService.obtenerDetalleGrupo(groupId);
    }

    @PatchMapping(Constantes.GRUPAL_UPDATE_METADATA)
    @Operation(summary = "Actualizar metadata de grupo", description = "Actualiza nombre, descripcion y/o foto del grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupo actualizado", content = @Content(schema = @Schema(implementation = GroupDetailDTO.class))),
            @ApiResponse(responseCode = "400", description = "Payload invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos para editar", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public GroupDetailDTO actualizarMetadataGrupo(@PathVariable("groupId") Long groupId,
                                                  @RequestBody GroupMetadataUpdateDTO dto) {
        return chatService.actualizarMetadataGrupo(groupId, dto);
    }

    @PostMapping(Constantes.GRUPAL_ADMIN_ADD)
    @Operation(summary = "Asignar admin de grupo", description = "Promueve un miembro como administrador del grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Rol actualizado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Grupo o usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void addAdmin(@PathVariable("groupId") Long groupId, @PathVariable("userId") Long userId) {
        chatService.setAdminGrupo(groupId, userId, true);
    }

    @DeleteMapping(Constantes.GRUPAL_ADMIN_REMOVE)
    @Operation(summary = "Quitar admin de grupo", description = "Retira privilegios de administrador a un miembro del grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Rol actualizado"),
            @ApiResponse(responseCode = "403", description = "Sin permisos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Grupo o usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void removeAdmin(@PathVariable("groupId") Long groupId, @PathVariable("userId") Long userId) {
        chatService.setAdminGrupo(groupId, userId, false);
    }

    @DeleteMapping(Constantes.GRUPAL_MIEMBRO_REMOVE)
    @Operation(summary = "Expulsar miembro de grupo", description = "Permite a ADMIN/CREADOR expulsar un miembro activo del grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Miembro expulsado", content = @Content(schema = @Schema(implementation = GroupMemberExpulsionResponseDTO.class))),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos o intento de expulsar al fundador", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado o inactivo", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public GroupMemberExpulsionResponseDTO expulsarMiembroGrupo(@PathVariable("groupId") Long groupId,
                                                                 @PathVariable("userId") Long userId) {
        return chatService.expulsarMiembroDeGrupo(groupId, userId);
    }

    @PostMapping(Constantes.GRUPAL)
    @Operation(summary = "Crear chat grupal", description = "Crea un grupo nuevo con nombre, foto y miembros iniciales.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Grupo creado", content = @Content(schema = @Schema(implementation = ChatGrupalDTO.class))),
            @ApiResponse(responseCode = "400", description = "Datos invalidos", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ChatGrupalDTO crearChatGrupal(@RequestBody ChatGrupalDTO dto) {
        return chatService.crearChatGrupal(dto);
    }

    @PostMapping(Constantes.GRUPAL_ADD_USUARIOS)
    @Operation(summary = "Anadir usuarios al grupo", description = "Invita o incorpora una lista de usuarios a un grupo existente.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuarios anadidos", content = @Content(schema = @Schema(implementation = AddUsuariosGrupoWSResponse.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos para gestionar miembros", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public AddUsuariosGrupoWSResponse anadirUsuariosAGrupo(
            @PathVariable("groupId") Long groupId,
            @RequestBody AddUsuariosGrupoDTO dto) {

        dto.setGroupId(groupId);

        return chatService.anadirUsuariosAGrupo(dto);
    }

    @GetMapping(Constantes.ADMIN_USUARIO_CHATS)
    @Operation(summary = "Listar chats de usuario (admin)", description = "Devuelve todas las conversaciones de un usuario para auditoria administrativa.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Conversaciones obtenidas"),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public List<ChatResumenDTO> getChatsUsuario(@PathVariable("id") Long id,
                                                @RequestParam(value = "includeExpired", defaultValue = "false") Boolean includeExpired) {
        return chatService.listarConversacionesDeUsuario(id, includeExpired);
    }

    @PostMapping(Constantes.GRUPAL_SALIR)
    @Operation(summary = "Salir de grupo", description = "Permite al usuario autenticado abandonar un grupo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Salida procesada", content = @Content(schema = @Schema(implementation = MessagueSalirGrupoDTO.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public MessagueSalirGrupoDTO salirDeChatGrupal(@RequestBody LeaveGroupRequestDTO dto) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        return chatService.salirDeChatGrupal(dto.getGroupId(), authenticatedUserId);
    }

    @GetMapping(Constantes.GRUPALES_USUARIO)
    @Operation(summary = "Listar grupos por usuario", description = "Obtiene chats grupales donde participa un usuario.")
    @ApiResponse(responseCode = "200", description = "Grupos obtenidos")
    public List<ChatGrupalDTO> listarGrupalesPorUsuario(@PathVariable("usuarioId") Long usuarioId) {
        return chatService.listarChatsGrupalesPorUsuario(usuarioId);
    }

    @GetMapping(Constantes.CHATS_USUARIO)
    @Operation(summary = "Listar todos los chats por usuario", description = "Devuelve juntos chats individuales y grupales de un usuario.")
    @ApiResponse(responseCode = "200", description = "Chats obtenidos")
    public List<Object> listarTodosLosChats(@PathVariable("usuarioId") Long usuarioId) {
        return chatService.listarTodosLosChatsDeUsuario(usuarioId);
    }

    @PutMapping(Constantes.CHAT_PINNED)
    @Operation(summary = "Fijar chat de usuario", description = "Fija un chat para el usuario autenticado o lo desfija si chatId es null.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Estado de chat fijado actualizado"),
            @ApiResponse(responseCode = "403", description = "No pertenece al chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public UserPinnedChatResponseDTO setPinnedChat(@RequestBody UserPinnedChatRequestDTO request) {
        return chatService.setPinnedChat(request);
    }

    @PostMapping(Constantes.CHAT_CLEAR)
    @Operation(summary = "Vaciar chat para el usuario autenticado", description = "Oculta el historial previo para el usuario autenticado sin borrar mensajes globalmente.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Chat vaciado para el usuario"),
            @ApiResponse(responseCode = "403", description = "No pertenece al chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<ChatClearResponseDTO> clearChat(@PathVariable("chatId") Long chatId) {
        return ResponseEntity.ok(chatService.clearChat(chatId));
    }

    @PatchMapping(Constantes.CHAT_HIDE_FOR_ME)
    @Operation(summary = "Ocultar chat para mi", description = "Oculta el chat solo para el usuario autenticado sin borrar chat/mensajes globalmente.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Chat ocultado para el usuario autenticado"),
            @ApiResponse(responseCode = "403", description = "No pertenece al chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> hideChatForMe(@PathVariable("chatId") Long chatId) {
        chatService.hideChatForMe(chatId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(Constantes.CHAT_MUTE)
    @Operation(summary = "Silenciar chat para el usuario autenticado", description = "Configura mute por 8h, 1 semana o para siempre en un chat individual o grupal.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mute aplicado"),
            @ApiResponse(responseCode = "400", description = "Duracion/payload invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "No pertenece al chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<ChatMuteStateDTO> muteChat(@PathVariable("chatId") Long chatId,
                                                      @RequestBody(required = false) ChatMuteRequestDTO request) {
        return ResponseEntity.ok(chatService.muteChat(chatId, request));
    }

    @DeleteMapping(Constantes.CHAT_MUTE)
    @Operation(summary = "Quitar silencio de chat", description = "Desactiva mute para el usuario autenticado en el chat indicado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mute desactivado"),
            @ApiResponse(responseCode = "403", description = "No pertenece al chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<ChatMuteStateDTO> unmuteChat(@PathVariable("chatId") Long chatId) {
        return ResponseEntity.ok(chatService.unmuteChat(chatId));
    }

    @GetMapping(Constantes.CHAT_MUTED)
    @Operation(summary = "Listar chats silenciados activos", description = "Devuelve los mutes activos del usuario autenticado para hidratar estado en frontend.")
    @ApiResponse(responseCode = "200", description = "Mutes activos obtenidos")
    public ResponseEntity<List<ChatMuteStateDTO>> listarMutesActivos() {
        return ResponseEntity.ok(chatService.listarChatsMuteadosActivos());
    }

    @GetMapping(Constantes.CHAT_PINNED)
    @Operation(summary = "Obtener chat fijado de usuario", description = "Devuelve el chat fijado del usuario autenticado o null si no tiene.")
    @ApiResponse(responseCode = "200", description = "Estado de chat fijado")
    public UserPinnedChatResponseDTO getPinnedChat() {
        return chatService.getPinnedChat();
    }

    @GetMapping(Constantes.LISTAR_MENSAJES_CHAT + "/{chatId}")
    @Operation(summary = "Historial de chat", description = "Lista mensajes de un chat (individual o grupal) con paginacion basica.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensajes obtenidos"),
            @ApiResponse(responseCode = "404", description = "Chat no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<List<MensajeDTO>> listarMensajesPorChatId(
            @PathVariable("chatId") Long chatId,
            @Parameter(description = "Pagina, inicia en 0") @RequestParam(value = "page", defaultValue = "0") Integer page,
            @Parameter(description = "Cantidad por pagina") @RequestParam(value = "size", defaultValue = "50") Integer size) {
        List<MensajeDTO> mensajes = chatService.listarMensajesPorChatId(chatId, page, size);
        return ResponseEntity.ok(mensajes);
    }

    @GetMapping(Constantes.MENSAJES_GRUPO)
    @Operation(summary = "Historial de grupo", description = "Lista mensajes de un chat grupal con paginacion.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensajes grupales obtenidos"),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<List<MensajeDTO>> listarMensajesPorChatGrupal(
            @PathVariable("chatId") Long chatId,
            @RequestParam(value = "page", defaultValue = "0") Integer page,
            @RequestParam(value = "size", defaultValue = "50") Integer size) {
        return ResponseEntity.ok(chatService.listarMensajesPorChatGrupal(chatId, page, size));
    }

    @GetMapping(Constantes.CHAT_PINNED_MESSAGE)
    @Operation(summary = "Obtener mensaje fijado del chat", description = "Devuelve el mensaje fijado activo del chat o null si no existe/expira.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensaje fijado obtenido o null si no hay fijado activo", content = @Content(schema = @Schema(implementation = ChatPinnedMessageDTO.class)))
    })
    public ChatPinnedMessageDTO getPinnedMessage(@PathVariable("chatId") Long chatId) {
        return chatService.getPinnedMessage(chatId);
    }

    @PostMapping(Constantes.CHAT_PINNED_MESSAGE)
    @Operation(summary = "Fijar mensaje en chat", description = "Fija un mensaje activo del chat por 24h, 7d o 30d, reemplazando el fijado anterior.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensaje fijado", content = @Content(schema = @Schema(implementation = ChatPinnedMessageDTO.class))),
            @ApiResponse(responseCode = "400", description = "Duración o payload inválido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos sobre el chat", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje/chat no válido para fijar", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ChatPinnedMessageDTO pinMessage(@PathVariable("chatId") Long chatId,
                                           @RequestBody ChatPinMessageRequestDTO request) {
        return chatService.pinMessage(chatId, request);
    }

    @DeleteMapping(Constantes.CHAT_PINNED_MESSAGE)
    @Operation(summary = "Desfijar mensaje del chat", description = "Desfija el mensaje activo del chat.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Desfijado"),
            @ApiResponse(responseCode = "404", description = "No había fijado activo", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> unpinMessage(@PathVariable("chatId") Long chatId) {
        chatService.unpinMessage(chatId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(Constantes.MENSAJES_ELIMINAR)
    @Operation(summary = "Eliminar mensaje", description = "Aplica borrado logico de un mensaje propio y registra fechaEliminacion en UTC.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensaje eliminado", content = @Content(schema = @Schema(implementation = MensajeDTO.class))),
            @ApiResponse(responseCode = "403", description = "No autorizado para eliminar el mensaje", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Conflicto de estado del mensaje", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<MensajeDTO> eliminarMensaje(@PathVariable("mensajeId") Long mensajeId) {
        return ResponseEntity.ok(mensajeriaService.eliminarMensajePropio(mensajeId, null));
    }

    @PostMapping(Constantes.MENSAJES_RESTAURAR)
    @Operation(summary = "Restaurar mensaje eliminado", description = "Restaura un mensaje eliminado logicamente por su emisor dentro de la ventana de 3 dias.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensaje restaurado", content = @Content(schema = @Schema(implementation = MensajeDTO.class))),
            @ApiResponse(responseCode = "403", description = "No autorizado para restaurar el mensaje", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Ventana de restauracion vencida", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<MensajeDTO> restaurarMensaje(@PathVariable("mensajeId") Long mensajeId) {
        return ResponseEntity.ok(mensajeriaService.restaurarMensajePropio(mensajeId));
    }

    @GetMapping(Constantes.MENSAJES_BUSCAR_CHAT)
    @Operation(summary = "Buscar mensajes en chat", description = "Busca texto dentro del historial de un chat y devuelve resultados paginados.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Busqueda completada", content = @Content(schema = @Schema(implementation = ChatMensajeBusquedaPageDTO.class))),
            @ApiResponse(responseCode = "400", description = "Consulta invalida", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<ChatMensajeBusquedaPageDTO> buscarMensajesPorChat(
            @PathVariable("chatId") Long chatId,
            @Parameter(description = "Texto a buscar") @RequestParam(value = "q") String q,
            @RequestParam(value = "page", defaultValue = "0") Integer page,
            @RequestParam(value = "size", defaultValue = "20") Integer size) {
        return ResponseEntity.ok(chatService.buscarMensajesEnChat(chatId, q, page, size));
    }

    @GetMapping(Constantes.GRUPAL_MEDIA)
    @Operation(summary = "Feed multimedia de grupo", description = "Lista audio, imagen, video y archivos de un grupo usando cursor para navegar.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Feed multimedia obtenido", content = @Content(schema = @Schema(implementation = GroupMediaPageDTO.class))),
            @ApiResponse(responseCode = "404", description = "Grupo no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<GroupMediaPageDTO> listarMediaPorChatGrupal(
            @PathVariable("chatId") Long chatId,
            @Parameter(description = "Cursor de paginacion para cargar mas") @RequestParam(value = "cursor", required = false) String cursor,
            @Parameter(description = "Tamano de pagina; si no se envia usa valor por defecto") @RequestParam(value = "size", required = false) Integer size,
            @Parameter(description = "Tipos separados por coma: AUDIO,IMAGE,VIDEO,FILE") @RequestParam(value = "types", required = false) String types) {
        return ResponseEntity.ok(chatService.listarMediaPorChatGrupal(chatId, cursor, size, types));
    }

    @GetMapping(Constantes.ADMIN_CHAT_MENSAJES)
    @Operation(summary = "Mensajes de chat (admin)", description = "Devuelve historial de un chat para revision administrativa.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensajes obtenidos"),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<List<MensajeDTO>> listarMensajesPorChatIdAdmin(
            @PathVariable("chatId") Long chatId,
            @RequestParam(value = "includeExpired", defaultValue = "false") Boolean includeExpired) {
        return ResponseEntity.ok(chatService.listarMensajesPorChatIdAdmin(chatId, includeExpired));
    }

    @PostMapping(Constantes.POLL_VOTE)
    @Operation(summary = "Votar encuesta en chat grupal", description = "Registra o alterna el voto del usuario autenticado para una encuesta.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Voto aplicado y encuesta actualizada"),
            @ApiResponse(responseCode = "403", description = "Sin permisos para votar en el grupo", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Mensaje/encuesta no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Conflicto de voto concurrente", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<MensajeDTO> votarEncuesta(
            @PathVariable("mensajeId") Long mensajeId,
            @RequestBody VotoEncuestaDTO payload) {
        payload.setMensajeId(mensajeId);
        return ResponseEntity.ok(mensajeriaService.votarEncuesta(payload));
    }

    @PostMapping(Constantes.MENSAJES_PROGRAMADOS)
    @Operation(summary = "Programar mensaje", description = "Programa el envio de un mensaje para una fecha/hora UTC exacta.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensajes programados correctamente"),
            @ApiResponse(responseCode = "400", description = "Payload invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos sobre chat destino", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<ProgramarMensajeResponseDTO> programarMensaje(
            @RequestBody ProgramarMensajeRequestDTO payload) {
        return ResponseEntity.ok(mensajeProgramadoService.crearMensajesProgramados(payload));
    }

    @GetMapping(Constantes.MENSAJES_PROGRAMADOS)
    @Operation(summary = "Listar mensajes programados", description = "Lista mensajes programados del usuario autenticado, opcionalmente filtrados por estado.")
    @ApiResponse(responseCode = "200", description = "Mensajes programados obtenidos")
    public ResponseEntity<List<MensajeProgramadoDTO>> listarMensajesProgramados(
            @RequestParam(value = "status", required = false) String status) {
        EstadoMensajeProgramado estado = parseEstadoProgramado(status);
        return ResponseEntity.ok(mensajeProgramadoService.listarMensajesProgramados(estado));
    }

    @PostMapping(Constantes.MENSAJES_PROGRAMADOS_CANCELAR)
    @Operation(summary = "Cancelar mensaje programado", description = "Cancela un mensaje programado en estado PENDING.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Cancelacion aplicada"),
            @ApiResponse(responseCode = "400", description = "No cancelable en estado actual", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Sin permisos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "No encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<MensajeProgramadoDTO> cancelarMensajeProgramado(
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(mensajeProgramadoService.cancelarMensajeProgramado(id));
    }

    private EstadoMensajeProgramado parseEstadoProgramado(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return EstadoMensajeProgramado.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("status invalido. Usa: PENDING, PROCESSING, SENT, FAILED, CANCELED");
        }
    }
}
