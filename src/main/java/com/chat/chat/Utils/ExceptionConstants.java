package com.chat.chat.Utils;

public class ExceptionConstants {

    // Errores de Roles y Permisos
    public static final String ERROR_NOT_AUTHORIZED_RESOLVE = "No autorizado para resolver esta notificacion";
    public static final String ERROR_NOT_AUTHORIZED_MARK = "No autorizado para marcar esta notificacion";
    public static final String ERROR_NOT_AUTHORIZED_PUBLIC_KEY = "No tienes permiso para actualizar esta llave publica";
    public static final String ERROR_CREATE_THIRD_PARTY_CHAT = "No tienes permiso para crear un chat entre dos terceros.";
    public static final String ERROR_NOT_GROUP_MEMBER = "El invitador no pertenece al grupo";
    public static final String ERROR_INVITE_NOT_FOR_USER = "Esta invitacion no corresponde al usuario";

    // Errores de Usuarios
    public static final String ERROR_EMAIL_EXISTS = "Ya existe un usuario con ese email";
    public static final String ERROR_CANT_BLOCK_SELF = "No puedes bloquearte a ti mismo";

    // Errores de Uploads y Archivos
    public static final String ERROR_AUDIO_SAVE_FAILED = "Fallo al almacenar el archivo de audio";
    public static final String ERROR_AUDIO_EMPTY = "El archivo de audio no puede estar vacio.";
    public static final String ERROR_FILE_SAVE_FAILED = "Fallo al almacenar el archivo";
    public static final String ERROR_FILE_EMPTY = "El archivo no puede estar vacio.";
    public static final String ERROR_FILE_TYPE_NOT_ALLOWED = "Tipo de archivo no permitido: ";
    public static final String ERROR_FILE_SIZE_EXCEEDED = "El archivo excede el tamano maximo permitido.";

    // Errores de Reenvio
    public static final String ERROR_REENVIO_ID_REQUERIDO = "mensajeOriginalId es obligatorio cuando reenviado=true";
    public static final String ERROR_REENVIO_ORIGINAL_NO_EXISTE = "Mensaje original no existe: ";
    public static final String ERROR_REENVIO_NO_AUTORIZADO = "No autorizado para reenviar este mensaje";

    // Errores de Respuesta
    public static final String ERROR_RESPUESTA_INVALIDA = "replyToMessageId invalido o no pertenece al chat destino";
    public static final String ERROR_RESPUESTA_NO_AUTORIZADA = "No autorizado para responder este mensaje";

    // Errores E2E
    public static final String ERROR_E2E_SENDER_NOT_FOUND = "Sender not found";
    public static final String ERROR_E2E_CHAT_ID_MISSING = "chatId missing";
    public static final String ERROR_E2E_GROUP_CHAT_NOT_FOUND = "Group chat not found";
    public static final String ERROR_E2E_SENDER_PUBLIC_KEY_MISSING = "Sender public key missing";
    public static final String ERROR_E2E_SENDER_NOT_ACTIVE_GROUP_MEMBER = "Sender is not an active group member";
    public static final String ERROR_E2E_GROUP_PAYLOAD_INVALID = "Invalid E2E_GROUP payload";
    public static final String ERROR_E2E_RECIPIENTS_MISMATCH = "forReceptores does not match active recipients";
    public static final String ERROR_E2E_GROUP_AUDIO_PAYLOAD_INVALID = "Invalid E2E_GROUP_AUDIO payload";
    public static final String ERROR_E2E_GROUP_AUDIO_RECIPIENTS_MISMATCH = "forReceptores does not match active recipients for group audio";
    public static final String ERROR_E2E_AUDIO_PAYLOAD_INVALID = "Invalid E2E_AUDIO payload";
    public static final String ERROR_E2E_IMAGE_PAYLOAD_INVALID = "Invalid E2E_IMAGE payload";
    public static final String ERROR_E2E_GROUP_IMAGE_PAYLOAD_INVALID = "Invalid E2E_GROUP_IMAGE payload";
    public static final String ERROR_E2E_FILE_PAYLOAD_INVALID = "Invalid E2E_FILE payload";
    public static final String ERROR_E2E_GROUP_FILE_PAYLOAD_INVALID = "Invalid E2E_GROUP_FILE payload";
    public static final String ERROR_MEDIA_CURSOR_INVALID = "cursor invalido";
    public static final String ERROR_MEDIA_TYPES_INVALID_PREFIX = "types contiene valor no soportado: ";
}
