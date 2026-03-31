package com.chat.chat.Utils;

public class Constantes {

    // Rutas API Chat
    public static final String API_CHAT = "/api/chat";

    public static final String API_MENSAJERIA = "/api/mensajeria";
    public static final String API_MENSAJES = "/api/mensajes";

    public static final String LISTAR_MENSAJES_CHAT = "/mensajes";

    public static final String USUARIO_API = "/api/usuarios";

    public static final String REGISTRO = "/registro";

    public static final String INDIVIDUAL = "/individual";
    public static final String GRUPAL = "/grupal";
    public static final String GRUPAL_UPDATE_METADATA = "/grupal/{groupId}";
    public static final String GRUPAL_MEDIA = "/grupal/{chatId}/media";
    public static final String GRUPAL_DETALLE = "/grupal/{groupId}/detalle";
    public static final String GRUPAL_ADMIN_ADD = "/grupal/{groupId}/admins/{userId}";
    public static final String GRUPAL_ADMIN_REMOVE = "/grupal/{groupId}/admins/{userId}";
    public static final String GRUPAL_MIEMBRO_REMOVE = "/grupal/{groupId}/miembros/{userId}";

    public static final String LOGIN = "/login";
    public static final String GOOGLE_AUTH = "/google";
    public static final String GOOGLE_AUTH_ALIAS = "/google/auth";
    public static final String GOOGLE_AUTH_POR_MODO = "/{mode}/google";
    public static final String GOOGLE_AUTH_MODE_PATTERN = "/*/google";
    public static final String GOOGLE_PROVIDER = "GOOGLE";
    public static final String GOOGLE_MODE_LOGIN = "login";
    public static final String GOOGLE_MODE_REGISTER = "register";

    public static final String GRUPAL_SALIR = GRUPAL + "/salir";

    public static final String GRUPAL_ES_MIEMBRO = GRUPAL + "/{groupId}/es-miembro/{userId}";
    public static final String CHATS_USUARIO = "/usuario/{usuarioId}/todos";
    public static final String GRUPALES_USUARIO = "/grupal/usuario/{usuarioId}";

    // Rutas Notificaciones
    public static final String NOTIFICACIONES_COUNT = "/count";
    public static final String NOTIFICACIONES_PENDIENTES = "/{userId}/pending";
    public static final String NOTIFICACIONES_RESOLVER = "/{notifId}/resolve";
    public static final String NOTIFICACIONES_VISTA = "/{id}/seen";
    public static final String NOTIFICACIONES_VISTAS_TODAS = "/seen-all";

    // Rutas Usuarios y Auth
    public static final String USUARIOS_ACTIVOS = "/activos";
    public static final String USUARIO_POR_ID = "/{id}";
    public static final String USUARIO_BUSCAR = "/buscar";
    public static final String USUARIO_PUBLIC_KEY = "/{id}/public-key";
    public static final String USUARIO_E2E_STATE = "/{id}/e2e/state";
    public static final String USUARIO_E2E_REKEY = "/{id}/e2e/rekey";
    public static final String USUARIO_E2E_PRIVATE_KEY_BACKUP = "/{userId}/e2e/private-key-backup";
    public static final String USUARIO_ADMIN_PATTERN = "/admin/**";
    public static final String USUARIO_PERFIL = "/perfil";
    public static final String USUARIO_PERFIL_PASSWORD_CODE = "/perfil/password/solicitar-codigo";
    public static final String USUARIO_PERFIL_PASSWORD_CHANGE = "/perfil/password/cambiar";
    public static final String SOLICITUD_DESBANEO_CREATE = "/solicitudes-desbaneo";

    // Rutas Recuperación Contraseña
    public static final String RECUPERAR_PASSWORD_SOLICITAR = "/recuperar-password/solicitar";
    public static final String RECUPERAR_PASSWORD_VERIFICAR = "/recuperar-password/verificar-y-cambiar";
    public static final String RECUPERAR_PASSWORD_ALL = "/recuperar-password/**";

    // Rutas Mensajeria y Chat
    public static final String MENSAJES_GRUPO = "/mensajes/grupo/{chatId}";
    public static final String MENSAJES_BUSCAR_CHAT = "/mensajes/{chatId}/buscar";
    public static final String MENSAJES_MARCAR_LEIDOS = "/mensajes/marcar-leidos";
    public static final String MENSAJE_DESTACAR = "/{mensajeId}/destacar";
    public static final String MENSAJES_DESTACADOS = "/destacados";
    public static final String MENSAJES_ELIMINAR = "/mensajes/{mensajeId}/eliminar";
    public static final String MENSAJES_RESTAURAR = "/mensajes/{mensajeId}/restaurar";
    public static final String POLL_VOTE = "/poll/{mensajeId}/vote";
    public static final String MENSAJES_PROGRAMADOS = "/scheduled";
    public static final String MENSAJES_PROGRAMADOS_CANCELAR = "/scheduled/{id}/cancel";
    public static final String GRUPAL_ADD_USUARIOS = "/{groupId}/usuarios";
    public static final String CHAT_PINNED = "/pinned";
    public static final String CHAT_CLEAR = "/{chatId}/clear";
    public static final String CHAT_HIDE_FOR_ME = "/{chatId}/hide-for-me";
    public static final String CHAT_MUTE = "/{chatId}/mute";
    public static final String CHAT_MUTED = "/muted";
    public static final String CHAT_PINNED_MESSAGE = "/{chatId}/pinned-message";

    // Rutas Base Restantes (RequestMapping)
    public static final String API_UPLOADS = "/api/uploads";
    public static final String API_NOTIFICATIONS = "/api/notifications";
    public static final String API_GROUP_INVITES = "/api/group-invites";
    public static final String API_ESTADO = "/api/estado";
    public static final String API_KEYS = "/api/keys";
    public static final String API_UPLOADS_ALL = "/api/uploads";
    public static final String API_AI = "/api/ai";
    public static final String API_AI_PATTERN = "/api/ai/**";

    // Subrutas Restantes
    public static final String USUARIOS_SUB = "/usuarios";
    public static final String GROUP_INVITE_ACCEPT = "/{inviteId}/accept";
    public static final String GROUP_INVITE_DECLINE = "/{inviteId}/decline";
    public static final String KEYS_AUDIT_PUBLIC = "/audit-public";
    public static final String ADMIN_DASHBOARD_STATS = "/admin/dashboard-stats";
    public static final String ADMIN_RECIENTES = "/admin/recientes";
    public static final String ADMIN_USUARIO_CHATS = "/admin/usuario/{id}/chats";
    public static final String ADMIN_CHAT_MENSAJES = "/admin/chat/{chatId}/mensajes";
    public static final String ADMIN_USUARIO_BAN = "/admin/{id}/ban";
    public static final String ADMIN_USUARIO_UNBAN = "/admin/{id}/unban";
    public static final String ADMIN_SOLICITUD_DESBANEO_LIST = "/admin/solicitudes-desbaneo";
    public static final String ADMIN_SOLICITUD_DESBANEO_BY_ID = "/admin/solicitudes-desbaneo/{id}";
    public static final String ADMIN_SOLICITUD_DESBANEO_ESTADO = "/admin/solicitudes-desbaneo/{id}/estado";
    public static final String ADMIN_SOLICITUD_DESBANEO_STATS = "/admin/solicitudes-desbaneo/stats";
    public static final String USUARIO_BLOQUEAR = "/{bloqueadoId}/bloquear";
    public static final String USUARIO_DESBLOQUEAR = "/{bloqueadoId}/desbloquear";

    // Rutas Upload
    public static final String UPLOAD_AUDIO = "/audio";
    public static final String UPLOAD_FILE = "/file";
    public static final String UPLOAD_MEDIA = "/media";
    public static final String UPLOAD_IMAGE = "/image";

    // Mensajes API
    public static final String KEY_MENSAJE = "mensaje";
    public static final String MSG_USUARIO_BLOQUEADO = "Usuario bloqueado";
    public static final String MSG_USUARIO_DESBLOQUEADO = "Usuario desbloqueado";
    public static final String MSG_EMAIL_REQUERIDO = "Email es requerido";
    public static final String MSG_EMAIL_NO_REGISTRADO = "El email proporcionado no está registrado en el sistema.";
    public static final String MSG_EMAIL_INCORRECTO = "Email incorrecto";
    public static final String MSG_CODIGO_ENVIADO = "Código enviado al correo";
    public static final String MSG_ERROR_ENVIANDO_CORREO = "Error enviando correo";
    public static final String MSG_FALTAN_DATOS_REQUERIDOS = "Faltan datos requeridos";
    public static final String MSG_CODIGO_INVALIDO_O_EXPIRADO = "Código inválido o expirado";
    public static final String MSG_CONTRASENA_ACTUALIZADA = "Contraseña actualizada exitosamente";
    public static final String MSG_PASSWORD_INCORRECTA = "Contraseña incorrecta";
    public static final String MSG_USUARIO_REACTIVADO = "Usuario reactivado exitosamente";
    public static final String DEFAULT_FALSE = "false";
    public static final String PROP_UPLOADS_ROOT = "${app.uploads.root:uploads}";
    public static final String PROP_UPLOADS_BASE_URL = "${app.uploads.base-url:/uploads}";
    public static final String PROP_DB_FIX_MENSAJES_TIPO = "${app.db.fix-mensajes-tipo-system-on-startup:true}";
    public static final String MIME_APPLICATION_OCTET_STREAM = "application/octet-stream";

    // Claves comunes
    public static final String KEY_UNSEEN_COUNT = "unseenCount";

    // Websocket
    public static final String TOPIC_CALL_SDP_OFFER = "/topic/call.sdp.offer.";
    public static final String TOPIC_CALL_SDP_ANSWER = "/topic/call.sdp.answer.";
    public static final String TOPIC_CALL_ICE = "/topic/call.ice.";
    public static final String TOPIC_CHAT = "/topic/chat.";
    public static final String TOPIC_CHAT_GRUPAL = "/topic/chat.grupal.";
    public static final String TOPIC_CHAT_REACCION = "/topic/chat.reaccion.";
    public static final String TOPIC_ESCRIBIENDO = "/topic/escribiendo.";
    public static final String TOPIC_ESCRIBIENDO_GRUPO = "/topic/escribiendo.grupo.";
    public static final String TOPIC_AUDIO_GRABANDO = "/topic/audio.grabando.";
    public static final String TOPIC_AUDIO_GRABANDO_GRUPO = "/topic/audio.grabando.grupo.";
    public static final String TOPIC_ESTADO = "/topic/estado.";
    public static final String TOPIC_CALL_INVITE = "/topic/call.invite.";
    public static final String TOPIC_CALL_ANSWER = "/topic/call.answer.";
    public static final String TOPIC_CALL_END = "/topic/call.end.";
    public static final String RINGING = "RINGING";

    // Puedes añadir aquí otras constantes globales:
    public static final String ADMIN = "ADMIN";
    public static final String USER = "USER";
    public static final String USUARIO = "USUARIO";
    public static final String ROLE_PREFIX = "ROLE_";
    public static final String ROLE_ADMIN = "ROLE_ADMIN";
    public static final String ROLE_USER = "ROLE_USER";
    public static final String ROLE_USUARIO = "ROLE_USUARIO";
    public static final String DEFAULT_CALLER_NAME = "Usuario";


    public static final String WS_TOPIC_NOTIFICATIONS = "/topic/notifications.";
    public static final String WS_TOPIC_LEIDO = "/topic/leido.";
    public static final String TOPIC_ADMIN_SOLICITUDES_DESBANEO = "/topic/admin.solicitudes-desbaneo";
    public static final String WS_TOPIC_USER_BLOQUEOS_PREFIX = "/topic/user/";
    public static final String WS_TOPIC_USER_BLOQUEOS_SUFFIX = "/bloqueos";
    public static final String WS_QUEUE_BANEOS = "/queue/baneos";
    public static final String WS_QUEUE_ERRORS = "/queue/errors";
    public static final String WS_BLOCK_STATUS_PAYLOAD_TEMPLATE = "{\"blockerId\":%d,\"type\":\"%s\"}";
    public static final String WS_BAN_PAYLOAD_TEMPLATE = "{\"banned\": true, \"motivo\": \"%s\"}";

    public static final String DATA_IMAGE_PREFIX = "data:image";
    public static final String DATA_AUDIO_PREFIX = "data:audio";
    public static final String UPLOADS_PREFIX = "/uploads/";
    public static final String HTTP_PREFIX = "http";
    public static final String DIR_GROUP_PHOTOS = "group-photos";
    public static final String DIR_AVATARS = "avatars";
    public static final String DIR_VOICE = "voice";
    public static final String DIR_MEDIA = "media";

    public static final String MSG_CHAT_INDIVIDUAL_BLOQUEADO = "No puedes crear un chat individual con un usuario bloqueado";
    public static final String MSG_CREADOR_NO_ENCONTRADO = "Creador no encontrado";
    public static final String MSG_USUARIO_INVITADO_NO_EXISTE = "Usuario invitado no existe: ";
    public static final String MSG_GROUP_ID_OBLIGATORIO = "groupId es obligatorio.";
    public static final String MSG_GRUPO_NO_EXISTE_ID = "No existe el grupo con id: ";
    public static final String MSG_USUARIO_NO_EXISTE_ID = "No existe el usuario con id: ";
    public static final String MSG_NO_PERTENECE_GRUPO = "No perteneces a este grupo.";
    public static final String MSG_SALIO_GRUPO_ELIMINADO = "Has salido del grupo. El grupo se ha eliminado por quedar vacío.";
    public static final String MSG_SALIO_GRUPO = "Has salido del grupo.";
    public static final String MSG_CHAT_GRUPAL_NO_EXISTE = "Chat grupal no existe: ";
    public static final String MSG_INVITADOR_NO_EXISTE = "Invitador no existe: ";
    public static final String MSG_CHAT_NO_ENCONTRADO_ID = "Chat no encontrado con ID: ";
    public static final String MSG_NO_PERTENECE_CHAT = "No perteneces a este chat.";
    public static final String MSG_CHAT_GRUPAL_NO_ENCONTRADO_ID = "Chat grupal no encontrado con ID: ";
    public static final String MSG_NO_SE_PUEDE_QUITAR_ADMIN_FUNDADOR = "No se puede quitar el rol admin al fundador del grupo.";
    public static final String MSG_NO_SE_PUEDE_EXPULSAR_FUNDADOR = "No se puede expulsar al fundador del grupo.";
    public static final String MSG_NO_SE_PUEDE_EXPULSAR_A_SI_MISMO = "No puedes expulsarte a ti mismo. Usa la opcion salir del grupo.";
    public static final String MSG_MIEMBRO_EXPULSADO_GRUPO = "Miembro expulsado del grupo.";
    public static final String CHAT_TIPO_INDIVIDUAL = "INDIVIDUAL";
    public static final String CHAT_TIPO_GRUPAL = "GRUPAL";
    public static final String TIPO_AUDIO = "AUDIO";
    public static final String TIPO_IMAGE = "IMAGE";
    public static final String TIPO_VIDEO = "VIDEO";
    public static final String TIPO_FILE = "FILE";
    public static final String TIPO_POLL = "POLL";
    public static final String TIPO_TEXT = "TEXT";
    public static final String TIPO_SYSTEM = "SYSTEM";
    public static final String MSG_Y = " y ";
    public static final String MSG_GRUPO_SUFFIX = " (Grupo)";
    public static final String MSG_SIN_DATOS = "Sin datos";

    public static final String MSG_NOTIFICACION_NO_EXISTE = "Notificación no existe: ";
    public static final String MSG_INVITACION_NO_EXISTE = "Invitación no existe: ";
    public static final String MSG_INVITACION_YA_RESUELTA = "La invitación ya fue resuelta.";
    public static final String MSG_USUARIO_YA_MIEMBRO_GRUPO = "El usuario ya pertenece al grupo.";
    public static final String MSG_INVITACION_PENDIENTE_DUPLICADA = "Ya existe una invitación pendiente para este usuario en el grupo.";
    public static final String MSG_CHAT_INDIVIDUAL_NO_ENCONTRADO = "Chat individual no encontrado";
    public static final String MSG_NO_PUEDE_ENVIAR_MENSAJES = "No puedes enviar mensajes en esta conversación";
    public static final String MSG_CHAT_GRUPAL_NO_ENCONTRADO = "Chat grupal no encontrado";
    public static final String MSG_SOLO_MENSAJES_RECIBIDOS_DESTACAR = "Solo puedes destacar mensajes recibidos.";
    public static final String KEY_MENSAJE_ID = "mensajeId";

    public static final String MSG_USUARIO_NO_ENCONTRADO = "Usuario no encontrado";
    public static final String MSG_SOLICITUD_DESBANEO_CREADA = "Solicitud de desbaneo creada correctamente.";
    public static final String MSG_SOLICITUD_DESBANEO_EMAIL_NO_EXISTE = "No existe una cuenta asociada al email indicado.";
    public static final String MSG_SOLICITUD_DESBANEO_USUARIO_NO_BANEADO = "La cuenta indicada no se encuentra baneada.";
    public static final String MSG_SOLICITUD_DESBANEO_YA_ABIERTA = "Ya existe una solicitud de desbaneo en curso para este email.";
    public static final String MSG_SOLICITUD_DESBANEO_NO_ENCONTRADA = "Solicitud de desbaneo no encontrada.";
    public static final String MSG_SOLICITUD_DESBANEO_ESTADO_ACTUALIZADO = "Estado de solicitud actualizado correctamente.";
    public static final String MSG_SOLICITUD_DESBANEO_APROBADA_DEFAULT = "Tu solicitud de desbaneo ha sido aprobada tras revision administrativa.";
    public static final String MSG_SOLICITUD_DESBANEO_RECHAZADA_DEFAULT = "Por ahora no se aprueba tu desbaneo. Puedes volver a solicitar revision mas adelante.";
    public static final String MSG_CUENTA_INHABILITADA = "Esta cuenta ha sido inhabilitada por un administrador.";
    public static final String WS_TYPE_BLOCKED = "BLOCKED";
    public static final String WS_TYPE_UNBLOCKED = "UNBLOCKED";
    public static final String BAN_MOTIVO_DEFAULT = "Tu cuenta ha sido suspendida temporalmente por incumplimiento de las normas de uso de TejeChat.";
    public static final String UNBAN_MOTIVO_DEFAULT = "Tu cuenta ha sido reactivada tras la revisión administrativa.";
    public static final String LOG_GUARDANDO_MSG_INDIVIDUAL = "Guardando mensaje individual: emisor=";
    public static final String LOG_RECEPTOR = " receptor=";
    public static final String LOG_AUDIT_ADMIN_CHAT_PREVIEW = "AUDIT admin_chat_preview requesterId={} targetUserId={} chatId={} hasForAdmin={}";
    public static final String LOG_E2E_RECEPTION = "====== [BACKEND E2E LOG] RECEPTION ======";
    public static final String LOG_E2E_PAYLOAD = "Payload content received (Encrypted): ";
    public static final String LOG_E2E_SEPARATOR = "=========================================";
    public static final String LOG_E2E_INBOUND_GROUP = "[E2E_DIAG] stage=INBOUND_GROUP ts={} traceId={} chatId={} emisorId={} receptorId={} tipo={} class={} len={} hash12={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} senderKeyPresent={} expectedRecipientIds={} payloadForReceptoresKeys={} rejectReason={}";
    public static final String LOG_E2E_INBOUND_GROUP_PARSE_WARN = "[E2E_DIAG] stage=INBOUND_GROUP_PARSE_WARN ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_PRE_BROADCAST = "[E2E_DIAG] stage=PRE_BROADCAST ts={} traceId={} topic={} chatId={} messageId={} emisorId={} tipo={} class={} len={} hash12={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} senderKeyPresent={} expectedRecipientIds={} payloadForReceptoresKeys={} rejectReason={}";
    public static final String LOG_E2E_INBOUND_GROUP_REJECT = "[E2E_DIAG] stage=INBOUND_GROUP_REJECT ts={} traceId={} chatId={} emisorId={} receptorId={} tipo={} class={} len={} hash12={} senderKeyPresent={} expectedRecipientIds={} payloadForReceptoresKeys={} rejectReason={}";
    public static final String LOG_E2E_GROUP_FLOW_ERROR = "[E2E_DIAG] stage=GROUP_FLOW_ERROR ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_INBOUND_GROUP_AUDIO_VALIDATE = "[E2E_DIAG] stage=INBOUND_GROUP_AUDIO_VALIDATE ts={} traceId={} chatId={} messageId={} emisorId={} tipo={} class={} hash12={} forReceptoresKeys={} expectedRecipientIds={} payloadForReceptoresKeys={} valid={} rejectReason={}";
    public static final String LOG_E2E_INBOUND_INDIVIDUAL_AUDIO_REJECT = "[E2E_DIAG] stage=INBOUND_INDIVIDUAL_AUDIO_REJECT ts={} emisorId={} receptorId={} tipo={} class={} hash12={} rejectReason={}";
    public static final String LOG_E2E_GROUP_RECIPIENTS_BUILD = "[E2E_DIAG] stage=GROUP_RECIPIENTS_BUILD ts={} traceId={} messageId={} chatId={} senderId={} memberIdsAtSend={} recipientIdsUsed={} forReceptoresKeys={} senderKeyFp={} recipientKeyFp={}";
    public static final String LOG_E2E_INBOUND_GROUP_VALIDATE = "[E2E_DIAG] stage=INBOUND_GROUP_VALIDATE ts={} traceId={} chatId={} emisorId={} expectedRecipientIds={} payloadForReceptoresKeys={} valid={} rejectReason={}";
    public static final String LOG_E2E_PRE_PERSIST_REJECT = "[E2E_DIAG] stage=PRE_PERSIST_REJECT ts={} traceId={} chatId={} emisorId={} receptorId={} tipo={} classIn={} lenIn={} hashIn={} classOut={} lenOut={} hashOut={} transformed={} senderKeyPresent={} expectedRecipientIds={} payloadForReceptoresKeys={} rejectReason={}";
    public static final String LOG_E2E_PRE_PERSIST = "[E2E_DIAG] stage=PRE_PERSIST ts={} traceId={} chatId={} emisorId={} receptorId={} tipo={} classIn={} lenIn={} hashIn={} classOut={} lenOut={} hashOut={} transformed={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} senderKeyPresent={} expectedRecipientIds={} payloadForReceptoresKeys={} rejectReason={}";
    public static final String LOG_E2E_PRE_PERSIST_PARSE_WARN = "[E2E_DIAG] stage=PRE_PERSIST_PARSE_WARN ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_PRE_PERSIST_NORMALIZED_PARSE_WARN = "[E2E_DIAG] stage=PRE_PERSIST_NORMALIZED_PARSE_WARN ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_POST_PERSIST = "[E2E_DIAG] stage=POST_PERSIST ts={} traceId={} chatId={} messageId={} emisorId={} tipo={} class={} len={} hash12={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} senderKeyPresent={} recipientIdsUsed={} payloadForReceptoresKeys={} recipientKeyFp={}";
    public static final String LOG_E2E_POST_PERSIST_PARSE_WARN = "[E2E_DIAG] stage=POST_PERSIST_PARSE_WARN ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_PERSIST_ERROR = "[E2E_DIAG] stage=PERSIST_ERROR ts={} traceId={} chatId={} messageId={} errorClass={} rejectReason={}";
    public static final String LOG_E2E_HISTORY_OUT_CHAT_ID = "[E2E_DIAG] stage=HISTORY_OUT ts={} traceId={} endpoint=listarMensajesPorChatId chatId={} messageId={} emisorId={} tipo={} class={} len={} hash12={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} senderKeyPresentAtRead={}";
    public static final String LOG_E2E_HISTORY_OUT_CHAT_GRUPAL = "[E2E_DIAG] stage=HISTORY_OUT ts={} traceId={} endpoint=listarMensajesPorChatGrupal chatId={} messageId={} emisorId={} tipo={} class={} len={} hash12={} hasIv={} hasCiphertext={} hasForEmisor={} hasForReceptores={} hasForAdmin={} forReceptoresKeys={} recipientIdsUsed={} payloadForReceptoresKeys={} senderCurrentKeyFp={} currentMemberKeyFp={} senderKeyPresentAtRead={}";
    public static final String LOG_E2E_HISTORY_OUT_PARSE_WARN = "[E2E_DIAG] stage=HISTORY_OUT_PARSE_WARN ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_HISTORY_OUT_ERROR = "[E2E_DIAG] stage=HISTORY_OUT_ERROR ts={} traceId={} chatId={} messageId={} errorClass={}";
    public static final String LOG_E2E_ADMIN_CHAT_MESSAGES_RAW = "[E2E_DIAG] stage=ADMIN_CHAT_MESSAGES_RAW chatId={} messageId={} class={} decryptOk={} usedForAdmin={}";
    public static final String LOG_E2E_GROUP_DETAIL_MEMBERS = "[E2E_DIAG] stage=GROUP_DETAIL_MEMBERS ts={} chatId={} requesterId={} memberIds={} memberCount={} memberKeyFp={}";
    public static final String LOG_E2E_GROUP_MEMBER_LEFT_SYSTEM_MESSAGE_CREATED = "[E2E_DIAG] stage=GROUP_MEMBER_LEFT_SYSTEM_MESSAGE_CREATED chatId={} userId={} messageId={} tipo={} hash12={} len={}";
    public static final String LOG_E2E_GROUP_MEMBER_LEFT_SYSTEM_MESSAGE_BROADCAST = "[E2E_DIAG] stage=GROUP_MEMBER_LEFT_SYSTEM_MESSAGE_BROADCAST chatId={} userId={} messageId={} tipo={} hash12={} len={}";
    public static final String LOG_GROUP_MEMBER_EXPELLED_AUDIT = "GROUP_MEMBER_EXPELLED traceId={} actorId={} targetId={} groupId={} actorCanManage={} targetWasAdmin={}";
    public static final String LOG_E2E_ADMIN_CHAT_LIST_PREVIEW = "[E2E_DIAG] stage=ADMIN_CHAT_LIST_PREVIEW chatId={} messageId={} class={} decryptOk={} usedForAdmin={}";
    public static final String LOG_E2E_GROUP_MEDIA_LIST = "[E2E_DIAG] stage=GROUP_MEDIA_LIST traceId={} chatId={} requesterId={} cursor={} size={} types={} returned={} hasMore={}";
    public static final String LOG_E2E_GROUP_MEDIA_ITEM = "[E2E_DIAG] stage=GROUP_MEDIA_ITEM traceId={} chatId={} messageId={} tipo={} class={} len={} hash12={}";
    public static final String LOG_WS_MARK_READ = "[WS] /mensajes.marcarLeidos user={} ids={}";
    public static final String LOG_WS_MARK_READ_EMPTY = "[WS] /mensajes.marcarLeidos payload vacio";
    public static final String LOG_WS_MARK_READ_DONE = "[WS] marcarLeidos done count={}";
    public static final String LOG_WS_DELETE = "[WS] /chat.eliminar user={} payload={}";
    public static final String LOG_WS_DELETE_INVALID = "[WS] chat.eliminar payload invalido";
    public static final String LOG_WS_DELETE_RESULT = "[WS] eliminarMensajePropio id={} eliminado={}";
    public static final String LOG_WS_SEND_LEIDO = "[WS] -> /topic/leido.{} mensajeId={}";
    public static final String LOG_WS_SEND_CHAT_DELETE = "[WS] -> /topic/chat.{} id={} activo={}";
    public static final String LOG_WS_MARK_READ_NO_MSG = "[WS] marcarLeidos sin mensajes para ids={}";
    public static final String LOG_WS_MARK_READ_NO_EMISOR = "[WS] marcarLeidos mensaje sin emisor id={}";
    public static final String LOG_WS_DELETE_PAYLOAD = "[WS] chat.eliminar payload id={} chatId={} emisorId={} receptorId={} activo={}";
    public static final String LOG_WS_DELETE_EMIT = "[WS] chat.eliminar emit emisorId={} receptorId={} id={} activo={}";
    public static final String LOG_DELETE_MSG_STATE = "eliminarMensajePropio mensaje id={} emisorId={} activo={}";
    public static final String LOG_DELETE_MSG_NO_EMISOR = "eliminarMensajePropio mensaje sin emisor id={}";
    public static final String LOG_DELETE_MSG_NOT_FOUND = "eliminarMensajePropio mensaje no existe id={}";
    public static final String LOG_DELETE_MSG_NOT_OWNER = "eliminarMensajePropio no autorizado id={} emisorId={} authId={}";
    public static final String LOG_BLOCK_ATTEMPT = "INTENTO DE BLOQUEO: blocker=";
    public static final String LOG_BLOCK_SUCCESS = "USUARIO BLOQUEADO CON EXITO EN BD";
    public static final String LOG_BLOCK_ALREADY = "USUARIO YA ESTABA BLOQUEADO EN BD";
    public static final String LOG_UNBAN_APPEAL_CREATED = "[UNBAN_APPEAL] created id={} usuarioId={} email={} estado={} createdByPublicEndpoint=true";
    public static final String LOG_UNBAN_APPEAL_STATUS_UPDATED = "[UNBAN_APPEAL] status_update id={} oldEstado={} newEstado={} reviewedByAdminId={} at={}";
    public static final String EMAIL_VAR_NOMBRE = "nombre";
    public static final String EMAIL_VAR_MOTIVO = "motivo";
    public static final String EMAIL_SUBJECT_BAN = "Aviso de suspensión de cuenta - TejeChat";
    public static final String EMAIL_TEMPLATE_BAN = "templates/user-banned.html";
    public static final String EMAIL_SUBJECT_UNBAN = "¡Cuenta reactivada! Bienvenido de nuevo - TejeChat";
    public static final String EMAIL_TEMPLATE_UNBAN = "templates/user-unbanned.html";
    public static final String EMAIL_SUBJECT_UNBAN_REJECTED = "Resultado de tu solicitud de desbaneo - TejeChat";
    public static final String EMAIL_TEMPLATE_UNBAN_REJECTED = "templates/user-unban-rejected.html";
    public static final String EMAIL_SUBJECT_PASSWORD_RESET = "Recuperación de Contraseña - TejeChat";
    public static final String EMAIL_TEMPLATE_PASSWORD_RESET = "templates/password-reset.html";
    public static final String EMAIL_SUBJECT_PASSWORD_CHANGE = "Código de verificación para cambiar contraseña - TejeChat";
    public static final String EMAIL_TEMPLATE_PASSWORD_CHANGE = "templates/password-reset.html";
    public static final String KEY_MINUTES = "minutes";
    public static final String KEY_TITLE = "title";
    public static final String TITLE_PASSWORD_RESET = "Recuperación de contraseña";
    public static final String TITLE_PASSWORD_CHANGE = "Verificación de cambio de contraseña";
    public static final String LOG_DB_FIX_TIPO_MULTIMEDIA = "[DB_FIX] mensajes.tipo actualizado para soportar multimedia y SYSTEM";
    public static final String LOG_DB_FIX_TIPO_WARN = "[DB_FIX] no se pudo verificar/corregir mensajes.tipo: {}";
    public static final String LOG_DB_FIX_INDEX_CREATED = "[DB_FIX] indice {} creado para feed multimedia de grupo";

    // Estados de conexión
    public static final String ESTADO_CONECTADO = "Conectado";
    public static final String ESTADO_AUSENTE = "Ausente";
    public static final String ESTADO_DESCONECTADO = "Desconectado";

    // WS app destinations
    public static final String WS_APP_CALL_SDP_OFFER = "/call.sdp.offer";
    public static final String WS_APP_CALL_SDP_ANSWER = "/call.sdp.answer";
    public static final String WS_APP_CALL_ICE = "/call.ice";
    public static final String WS_APP_CALL_START = "/call.start";
    public static final String WS_APP_CALL_ANSWER = "/call.answer";
    public static final String WS_APP_CALL_END = "/call.end";
    public static final String WS_APP_CHAT_INDIVIDUAL = "/chat.individual";
    public static final String WS_APP_CHAT_ELIMINAR = "/chat.eliminar";
    public static final String WS_APP_CHAT_EDITAR = "/chat.editar";
    public static final String WS_APP_MENSAJES_MARCAR_LEIDOS = "/mensajes.marcarLeidos";
    public static final String WS_APP_ESCRIBIENDO = "/escribiendo";
    public static final String WS_APP_ESCRIBIENDO_GRUPO = "/escribiendo.grupo";
    public static final String WS_APP_AUDIO_GRABANDO = "/audio.grabando";
    public static final String WS_APP_AUDIO_GRABANDO_GRUPO = "/audio.grabando.grupo";
    public static final String WS_APP_ESTADO = "/estado";
    public static final String WS_APP_CHAT_GRUPAL = "/chat.grupal";
    public static final String WS_APP_CHAT_POLL_VOTE = "/chat.poll.vote";
    public static final String WS_APP_CHAT_REACCION = "/chat.reaccion";

    public static final String WS_ENDPOINT = "/ws-chat";
    public static final String WS_ENDPOINT_PATTERN = "/ws-chat/**";
    public static final String WS_APP_PREFIX = "/app";
    public static final String WS_BROKER_TOPIC = "/topic";
    public static final String WS_BROKER_QUEUE = "/queue";

    public static final String UPLOADS_PATTERN = "/uploads/**";

    public static final String MSG_USUARIO_AUTENTICADO_NO_ENCONTRADO = "Usuario autenticado no encontrado en DB";
    public static final String MSG_SOLO_ADMIN = "Solo administradores pueden acceder a este endpoint";

    // Call events
    public static final String CALL_EVENT_INVITE = "CALL_INVITE";
    public static final String CALL_EVENT_ANSWER = "CALL_ANSWER";
    public static final String CALL_EVENT_ENDED = "CALL_ENDED";

    // Security / headers
    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String HEADER_AUTHORIZATION_LOWER = "authorization";
    public static final String BEARER_PREFIX = "Bearer ";
    public static final String CORS_ANY_ORIGIN = "*";
    public static final String CORS_ORIGIN_LOCALHOST_4200 = "http://localhost:4200";
    public static final String CORS_ORIGIN_127_4200 = "http://127.0.0.1:4200";

    // Error codes
    public static final String ERR_EMAIL_INVALIDO = "EMAIL_INVALIDO";
    public static final String ERR_PASSWORD_INCORRECTA = "PASSWORD_INCORRECTA";
    public static final String ERR_USUARIO_INACTIVO = "USUARIO_INACTIVO";
    public static final String ERR_REENVIO_INVALIDO = "REENVIO_INVALIDO";
    public static final String ERR_REENVIO_NO_AUTORIZADO = "REENVIO_NO_AUTORIZADO";
    public static final String ERR_RESPUESTA_INVALIDA = "RESPUESTA_INVALIDA";
    public static final String ERR_SQL_INJECTION = "SQL_INJECTION_DETECTADA";
    public static final String ERR_RATE_LIMIT = "RATE_LIMIT_EXCEEDED";
    public static final String ERR_RESPUESTA_NO_AUTORIZADA = "RESPUESTA_NO_AUTORIZADA";
    public static final String ERR_NO_AUTORIZADO = "NO_AUTORIZADO";
    public static final String ERR_NO_ENCONTRADO = "NO_ENCONTRADO";
    public static final String ERR_CONFLICTO = "CONFLICTO";
    public static final String ERR_DELETE_TIMESTAMP_MISSING = "DELETE_TIMESTAMP_MISSING";
    public static final String ERR_RESTORE_WINDOW_EXPIRED = "RESTORE_WINDOW_EXPIRED";
    public static final String ERR_E2E_REKEY_CONFLICT = "E2E_REKEY_CONFLICT";
    public static final String ERR_E2E_REKEY_REQUIRED = "E2E_REKEY_REQUIRED";
    public static final String ERR_E2E_SENDER_KEY_MISSING = "E2E_SENDER_KEY_MISSING";
    public static final String ERR_E2E_RECIPIENT_KEYS_MISMATCH = "E2E_RECIPIENT_KEYS_MISMATCH";
    public static final String ERR_E2E_GROUP_PAYLOAD_INVALID = "E2E_GROUP_PAYLOAD_INVALID";
    public static final String ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID = "E2E_GROUP_AUDIO_PAYLOAD_INVALID";
    public static final String ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH = "E2E_AUDIO_RECIPIENT_KEYS_MISMATCH";
    public static final String ERR_E2E_AUDIO_PAYLOAD_INVALID = "E2E_AUDIO_PAYLOAD_INVALID";
    public static final String ERR_E2E_IMAGE_PAYLOAD_INVALID = "E2E_IMAGE_PAYLOAD_INVALID";
    public static final String ERR_E2E_GROUP_IMAGE_PAYLOAD_INVALID = "E2E_GROUP_IMAGE_PAYLOAD_INVALID";
    public static final String ERR_E2E_PAYLOAD_INVALID = "E2E_PAYLOAD_INVALID";
    public static final String ERR_E2E_FILE_PAYLOAD_INVALID = "E2E_FILE_PAYLOAD_INVALID";
    public static final String ERR_E2E_BACKUP_NOT_FOUND = "E2E_BACKUP_NOT_FOUND";
    public static final String ERR_E2E_BACKUP_INVALID = "E2E_BACKUP_INVALID";
    public static final String ERR_CHAT_PINNED_NOT_FOUND = "CHAT_PINNED_NOT_FOUND";
    public static final String ERR_CHAT_PIN_INVALID_DURATION = "CHAT_PIN_INVALID_DURATION";
    public static final String ERR_CHAT_PIN_MESSAGE_NOT_IN_CHAT = "CHAT_PIN_MESSAGE_NOT_IN_CHAT";
    public static final String ERR_CHAT_PIN_FORBIDDEN = "CHAT_PIN_FORBIDDEN";
    public static final String ERR_UPLOAD_SECURITY_BLOCK = "UPLOAD_SECURITY_BLOCK";
    public static final String ERR_SOLICITUD_DESBANEO_INVALIDA = "SOLICITUD_DESBANEO_INVALIDA";
    public static final String ERR_GOOGLE_TOKEN_INVALIDO = "GOOGLE_TOKEN_INVALIDO";
    public static final String ERR_GOOGLE_PROVIDER_INVALIDO = "GOOGLE_PROVIDER_INVALIDO";
    public static final String ERR_GOOGLE_MODE_INVALIDO = "GOOGLE_MODE_INVALIDO";
    public static final String ERR_GOOGLE_USUARIO_NO_REGISTRADO = "GOOGLE_USUARIO_NO_REGISTRADO";

    // Payload keys
    public static final String KEY_PUBLIC_KEY = "publicKey";
    public static final String KEY_AUDIT_PUBLIC_KEY = "auditPublicKey";
    public static final String KEY_EMAIL = "email";
    public static final String KEY_CODE = "code";
    public static final String KEY_NEW_PASSWORD = "newPassword";
    public static final String KEY_MOTIVO = "motivo";
    public static final String KEY_PROVIDER = "provider";
    public static final String KEY_MODE = "mode";
    public static final String KEY_ID_TOKEN = "idToken";
    public static final String KEY_CREDENTIAL = "credential";
    public static final String KEY_EMISOR_ID = "emisorId";
    public static final String KEY_ESCRIBIENDO = "escribiendo";
    public static final String KEY_GRABANDO_AUDIO = "grabandoAudio";
    public static final String KEY_CHAT_ID = "chatId";
    public static final String KEY_EMISOR_NOMBRE = "emisorNombre";
    public static final String KEY_EMISOR_APELLIDO = "emisorApellido";
    public static final String KEY_USER_ID = "userId";
    public static final String KEY_ES_SISTEMA = "esSistema";
    public static final String KEY_SYSTEM_EVENT = "systemEvent";
    public static final String KEY_TARGET_USER_ID = "targetUserId";
    public static final String KEY_Q = "q";
    public static final String KEY_FILE = "file";
    public static final String KEY_DUR_MS = "durMs";
    public static final String HEADER_USUARIO_ID = "usuarioId";

    // Queries DB fix mensajes.tipo
    public static final String SQL_INFO_SCHEMA_COLUMN_TYPE_MENSAJES_TIPO = "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND COLUMN_NAME = 'tipo'";
    public static final String SQL_ALTER_MENSAJES_TIPO_MULTIMEDIA = "ALTER TABLE mensajes MODIFY COLUMN tipo ENUM('TEXT','AUDIO','IMAGE','VIDEO','FILE','POLL','SYSTEM') NOT NULL DEFAULT 'TEXT'";
    public static final String SQL_INFO_SCHEMA_INDEX_COUNT = "SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND INDEX_NAME = ?";
    public static final String SQL_CREATE_INDEX_MENSAJES_MEDIA_FEED = "CREATE INDEX ";
    public static final String SQL_CREATE_INDEX_MENSAJES_MEDIA_FEED_SUFFIX = " ON mensajes (chat_id, tipo, activo, fecha_envio DESC, id DESC)";
    public static final String IDX_MENSAJES_MEDIA_FEED = "idx_mensajes_chat_tipo_activo_fecha_id";

    // System message events
    public static final String SYSTEM_EVENT_GROUP_MEMBER_REMOVED = "GROUP_MEMBER_REMOVED";
    public static final String SYSTEM_EVENT_GROUP_MEMBER_EXPELLED = "GROUP_MEMBER_EXPELLED";

    // Labels
    public static final String LABEL_INVITACION = "Invitación";
    public static final String LABEL_USUARIO = "Usuario";

    // Otros...
}

