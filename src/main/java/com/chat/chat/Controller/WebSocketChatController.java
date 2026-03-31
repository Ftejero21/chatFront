package com.chat.chat.Controller;

import com.chat.chat.Call.DTO.CallAnswerDTO;
import com.chat.chat.Call.DTO.CallEndDTO;
import com.chat.chat.Call.DTO.CallInviteDTO;
import com.chat.chat.Configuracion.EstadoUsuarioManager;
import com.chat.chat.DTO.AudioGrabandoDTO;
import com.chat.chat.DTO.AudioGrabandoGrupoDTO;
import com.chat.chat.DTO.EscribiendoDTO;
import com.chat.chat.DTO.EscribiendoGrupoDTO;
import com.chat.chat.DTO.EstadoDTO;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MensajeReaccionDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.E2EGroupValidationException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.CallService.CallService;
import com.chat.chat.Service.MensajeriaService.MensajeriaService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.E2EDiagnosticUtils;
import com.chat.chat.Utils.E2EGroupValidationUtils;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.SecurityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@RestController
public class WebSocketChatController {
    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketChatController.class);
    private static final String LOG_WS_SEND = "[WS] send to receptor ";
    private static final String LOG_WS_FROM = " from ";
    private static final String LOG_WS_TIPO = " tipo=";

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private EstadoUsuarioManager estadoUsuarioManager;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ChatGrupalRepository chatGrupalRepository;

    @Autowired
    private MensajeriaService mensajeriaService;

    @Autowired
    private CallService callService;

    @Autowired
    private SecurityUtils securityUtils;

    @Value("${app.ws.reactions.legacy-broadcast:false}")
    private boolean legacyReactionBroadcastEnabled;

    @Value("${app.uploads.security.max-file-bytes:26214400}")
    private long maxUploadFileBytes;

    // 1) A → INVITE → B
    @MessageMapping(Constantes.WS_APP_CALL_START)
    public void startCall(@Payload CallInviteDTO dto) {
        callService.startCall(dto);
    }

    // 2) B → ANSWER → A
    @MessageMapping(Constantes.WS_APP_CALL_ANSWER)
    public void answer(@Payload CallAnswerDTO dto) {
        callService.answerCall(dto);
    }

    // 3) END desde cualquiera
    @MessageMapping(Constantes.WS_APP_CALL_END)
    public void end(@Payload CallEndDTO dto) {
        callService.endCall(dto);
    }

    @MessageMapping(Constantes.WS_APP_CHAT_INDIVIDUAL)
    public void enviarMensajeIndividual(@Payload MensajeDTO mensajeDTO) {
        System.out.println(Constantes.LOG_E2E_RECEPTION);
        System.out.println(Constantes.LOG_E2E_PAYLOAD + mensajeDTO.getContenido());
        System.out.println(Constantes.LOG_E2E_SEPARATOR);

        MensajeDTO guardado = mensajeriaService.guardarMensajeIndividual(mensajeDTO);

        System.out.println(LOG_WS_SEND + guardado.getReceptorId() +
                LOG_WS_FROM + guardado.getEmisorId() +
                LOG_WS_TIPO + guardado.getTipo());
        messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + guardado.getReceptorId(), guardado);
        // ✅ Enviar también al emisor (para que lo vea con id y estado)
        messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + guardado.getEmisorId(), guardado);
    }

    @MessageMapping(Constantes.WS_APP_CHAT_EDITAR)
    public void editarMensaje(@Payload MensajeDTO mensajeDTO) {
        MensajeDTO editado = mensajeriaService.editarMensajePropio(mensajeDTO);

        if (editado.getChatId() != null && editado.getReceptorId() == null) {
            messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_GRUPAL + editado.getChatId(), editado);
            return;
        }
        if (editado.getReceptorId() == null || editado.getEmisorId() == null) {
            throw new IllegalArgumentException("No se pudo resolver destinatarios para la edicion");
        }

        messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + editado.getReceptorId(), editado);
        messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + editado.getEmisorId(), editado);
    }

    @MessageMapping(Constantes.WS_APP_CHAT_ELIMINAR)
    public void eliminarMensaje(@Payload MensajeDTO mensajeDTO) {
        LOGGER.info(Constantes.LOG_WS_DELETE, "unknown", mensajeDTO);
        if (mensajeDTO == null || mensajeDTO.getId() == null) {
            LOGGER.warn(Constantes.LOG_WS_DELETE_INVALID);
            return;
        }

        MensajeDTO eliminado = mensajeriaService.eliminarMensajePropio(
                mensajeDTO.getId(),
                mensajeDTO.getMotivoEliminacion());
        LOGGER.info(Constantes.LOG_WS_DELETE_RESULT, mensajeDTO.getId(), eliminado != null);
    }

    @MessageMapping(Constantes.WS_APP_MENSAJES_MARCAR_LEIDOS)
    public void marcarMensajesLeidos(@Payload List<Long> ids) {
        LOGGER.info(Constantes.LOG_WS_MARK_READ, "unknown", ids);
        if (ids == null || ids.isEmpty()) {
            LOGGER.info(Constantes.LOG_WS_MARK_READ_EMPTY);
            return;
        }
        mensajeriaService.marcarMensajesComoLeidos(ids);
        LOGGER.info(Constantes.LOG_WS_MARK_READ_DONE, ids.size());
    }

    @MessageMapping(Constantes.WS_APP_ESCRIBIENDO)
    public void indicarEscribiendo(@Payload EscribiendoDTO dto) {

        Map<String, Object> payload = new HashMap<>();
        payload.put(Constantes.KEY_EMISOR_ID, dto.getEmisorId());
        payload.put(Constantes.KEY_ESCRIBIENDO, dto.isEscribiendo());

        messagingTemplate.convertAndSend(Constantes.TOPIC_ESCRIBIENDO + dto.getReceptorId(), payload);
    }

    @MessageMapping(Constantes.WS_APP_ESCRIBIENDO_GRUPO)
    public void indicarEscribiendoGrupo(@Payload EscribiendoGrupoDTO dto) {
        Map<String, Object> payload = new HashMap<>();
        payload.put(Constantes.KEY_EMISOR_ID, dto.getEmisorId());
        payload.put(Constantes.KEY_CHAT_ID, dto.getChatId());
        payload.put(Constantes.KEY_ESCRIBIENDO, dto.isEscribiendo());

        usuarioRepository.findById(dto.getEmisorId()).ifPresent(u -> {
            payload.put(Constantes.KEY_EMISOR_NOMBRE, u.getNombre());
            payload.put(Constantes.KEY_EMISOR_APELLIDO, u.getApellido());
        });

        messagingTemplate.convertAndSend(Constantes.TOPIC_ESCRIBIENDO_GRUPO + dto.getChatId(), payload);
    }

    @MessageMapping(Constantes.WS_APP_AUDIO_GRABANDO)
    public void indicarGrabandoAudio(@Payload AudioGrabandoDTO dto) {
        if (dto == null || dto.getReceptorId() == null) {
            return;
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        Map<String, Object> payload = new HashMap<>();
        payload.put(Constantes.KEY_EMISOR_ID, authenticatedUserId);
        payload.put(Constantes.KEY_GRABANDO_AUDIO, dto.isGrabandoAudio());

        messagingTemplate.convertAndSend(Constantes.TOPIC_AUDIO_GRABANDO + dto.getReceptorId(), payload);
    }

    @MessageMapping(Constantes.WS_APP_AUDIO_GRABANDO_GRUPO)
    public void indicarGrabandoAudioGrupo(@Payload AudioGrabandoGrupoDTO dto) {
        if (dto == null || dto.getChatId() == null) {
            throw new IllegalArgumentException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (dto.getEmisorId() != null && !Objects.equals(dto.getEmisorId(), authenticatedUserId)) {
            throw new AccessDeniedException(Constantes.ERR_RESPUESTA_NO_AUTORIZADA);
        }

        ChatGrupalEntity chat = chatGrupalRepository.findByIdWithUsuarios(dto.getChatId())
                .orElseThrow(() -> new IllegalArgumentException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO_ID + dto.getChatId()));
        if (!chat.isActivo()) {
            throw new AccessDeniedException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
        }

        UsuarioEntity emisor = findActiveGroupMember(chat, authenticatedUserId)
                .orElseThrow(() -> new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO));

        Map<String, Object> payload = buildAudioGrabandoPayload(
                authenticatedUserId,
                dto.getChatId(),
                dto.isGrabandoAudio(),
                emisor);

        messagingTemplate.convertAndSend(Constantes.TOPIC_AUDIO_GRABANDO_GRUPO + dto.getChatId(), payload);
        for (UsuarioEntity member : chat.getUsuarios()) {
            if (member == null || member.getId() == null || !member.isActivo()) {
                continue;
            }
            if (Objects.equals(member.getId(), authenticatedUserId)) {
                continue;
            }
            messagingTemplate.convertAndSend(Constantes.TOPIC_AUDIO_GRABANDO + member.getId(), payload);
        }
    }

    @MessageMapping(Constantes.WS_APP_ESTADO)
    public void actualizarEstadoUsuario(@Payload EstadoDTO dto) {
        if (Constantes.ESTADO_CONECTADO.equalsIgnoreCase(dto.getEstado())) {
            estadoUsuarioManager.marcarConectado(dto.getUsuarioId());
        } else {
            estadoUsuarioManager.marcarDesconectado(dto.getUsuarioId());
        }

        messagingTemplate.convertAndSend(Constantes.TOPIC_ESTADO + dto.getUsuarioId(), dto.getEstado());
    }

    @MessageMapping(Constantes.WS_APP_CHAT_GRUPAL)
    public void enviarMensajeGrupal(@Payload MensajeDTO mensajeDTO) {
        String traceId = E2EDiagnosticUtils.currentTraceId();
        boolean createdTraceId = false;
        if (traceId == null) {
            traceId = E2EDiagnosticUtils.newTraceId();
            MDC.put(E2EDiagnosticUtils.TRACE_ID_MDC_KEY, traceId);
            createdTraceId = true;
        }

        Long chatId = resolveChatId(mensajeDTO);
        String inboundContent = mensajeDTO == null ? null : mensajeDTO.getContenido();
        E2EDiagnosticUtils.ContentDiagnostic inboundDiag = E2EDiagnosticUtils.analyze(
                inboundContent,
                mensajeDTO == null ? null : mensajeDTO.getTipo());
        Long authenticatedUserId = null;
        UsuarioEntity sender = null;
        boolean senderKeyPresent = false;
        List<Long> expectedRecipientIds = List.of();
        Set<String> payloadForReceptoresKeys = E2EGroupValidationUtils.payloadRecipientKeySet(inboundContent);
        String rejectReason = "-";
        try {
            authenticatedUserId = securityUtils.getAuthenticatedUserId();
            Optional<UsuarioEntity> senderOpt = usuarioRepository.findFreshById(authenticatedUserId);
            if (senderOpt.isEmpty()) {
                senderOpt = usuarioRepository.findById(authenticatedUserId);
            }
            sender = senderOpt.orElseThrow(() -> new E2EGroupValidationException(
                    Constantes.ERR_E2E_SENDER_KEY_MISSING,
                    ExceptionConstants.ERROR_E2E_SENDER_NOT_FOUND));
            senderKeyPresent = E2EGroupValidationUtils.hasPublicKey(sender.getPublicKey());
            if (chatId == null) {
                throw new E2EGroupValidationException(Constantes.ERR_E2E_GROUP_PAYLOAD_INVALID, ExceptionConstants.ERROR_E2E_CHAT_ID_MISSING);
            }

            ChatGrupalEntity chat = chatGrupalRepository.findByIdWithUsuarios(chatId)
                    .orElseThrow(() -> new E2EGroupValidationException(Constantes.ERR_E2E_GROUP_PAYLOAD_INVALID, ExceptionConstants.ERROR_E2E_GROUP_CHAT_NOT_FOUND));
            expectedRecipientIds = E2EGroupValidationUtils.expectedActiveRecipientIds(chat, authenticatedUserId);
            payloadForReceptoresKeys = E2EGroupValidationUtils.payloadRecipientKeySet(inboundContent);
            LOGGER.info(
                    Constantes.LOG_E2E_INBOUND_GROUP,
                    Instant.now(),
                    traceId,
                    chatId,
                    authenticatedUserId,
                    mensajeDTO == null ? null : mensajeDTO.getReceptorId(),
                    mensajeDTO == null ? null : mensajeDTO.getTipo(),
                    inboundDiag.getClassification(),
                    inboundDiag.getLength(),
                    inboundDiag.getHash12(),
                    inboundDiag.hasIv(),
                    inboundDiag.hasCiphertext(),
                    inboundDiag.hasForEmisor(),
                    inboundDiag.hasForReceptores(),
                    inboundDiag.hasForAdmin(),
                    inboundDiag.getForReceptoresKeys(),
                    senderKeyPresent,
                    expectedRecipientIds,
                    payloadForReceptoresKeys,
                    rejectReason);
            if ("INVALID_JSON".equals(inboundDiag.getClassification())) {
                LOGGER.warn(Constantes.LOG_E2E_INBOUND_GROUP_PARSE_WARN,
                        Instant.now(), traceId, chatId, mensajeDTO == null ? null : mensajeDTO.getId(), inboundDiag.getParseErrorClass());
            }

            validateInboundGroupMessage(
                    mensajeDTO,
                    chat,
                    authenticatedUserId,
                    senderKeyPresent,
                    inboundDiag,
                    payloadForReceptoresKeys,
                    traceId,
                    chatId,
                    expectedRecipientIds);

            MensajeDTO guardado = mensajeriaService.guardarMensajeGrupal(mensajeDTO);
            E2EDiagnosticUtils.ContentDiagnostic outDiag = E2EDiagnosticUtils.analyze(
                    guardado.getContenido(),
                    guardado.getTipo());
            String destination = Constantes.TOPIC_CHAT_GRUPAL + (mensajeDTO == null ? null : mensajeDTO.getReceptorId());
            LOGGER.info(
                    Constantes.LOG_E2E_PRE_BROADCAST,
                    Instant.now(),
                    traceId,
                    destination,
                    chatId,
                    guardado.getId(),
                    guardado.getEmisorId(),
                    guardado.getTipo(),
                    outDiag.getClassification(),
                    outDiag.getLength(),
                    outDiag.getHash12(),
                    outDiag.hasIv(),
                    outDiag.hasCiphertext(),
                    outDiag.hasForEmisor(),
                    outDiag.hasForReceptores(),
                    outDiag.hasForAdmin(),
                    outDiag.getForReceptoresKeys(),
                    senderKeyPresent,
                    expectedRecipientIds,
                    payloadForReceptoresKeys,
                    rejectReason);
            messagingTemplate.convertAndSend(destination, guardado);
        } catch (E2EGroupValidationException ex) {
            rejectReason = ex.getCode();
            LOGGER.warn(
                    Constantes.LOG_E2E_INBOUND_GROUP_REJECT,
                    Instant.now(),
                    traceId,
                    chatId,
                    mensajeDTO == null ? null : mensajeDTO.getEmisorId(),
                    mensajeDTO == null ? null : mensajeDTO.getReceptorId(),
                    mensajeDTO == null ? null : mensajeDTO.getTipo(),
                    inboundDiag.getClassification(),
                    inboundDiag.getLength(),
                    inboundDiag.getHash12(),
                    senderKeyPresent,
                    expectedRecipientIds,
                    payloadForReceptoresKeys,
                    rejectReason);
            sendGroupErrorToUser(sender, authenticatedUserId, chatId, traceId, ex.getCode(), ex.getMessage());
            return;
        } catch (RuntimeException ex) {
            LOGGER.error(Constantes.LOG_E2E_GROUP_FLOW_ERROR,
                    Instant.now(), traceId, chatId, mensajeDTO == null ? null : mensajeDTO.getId(), ex.getClass().getSimpleName());
            throw ex;
        } finally {
            if (createdTraceId) {
                MDC.remove(E2EDiagnosticUtils.TRACE_ID_MDC_KEY);
            }
        }
    }

    @MessageMapping(Constantes.WS_APP_CHAT_REACCION)
    public void reaccionarMensaje(@Payload MensajeReaccionDTO payload) {
        MensajeriaService.ReactionDispatchResult result = mensajeriaService.procesarReaccion(payload);
        MensajeReaccionDTO event = result.event();

        for (Long userId : result.recipientUserIds()) {
            if (userId == null) {
                continue;
            }
            messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_REACCION + userId, event);
        }

        if (legacyReactionBroadcastEnabled) {
            if (result.groupChat()) {
                messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_GRUPAL + result.chatId(), event);
            } else {
                for (Long userId : result.recipientUserIds()) {
                    if (userId == null) {
                        continue;
                    }
                    messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + userId, event);
                }
            }
        }
    }

    @MessageMapping(Constantes.WS_APP_CHAT_POLL_VOTE)
    public void votarEncuesta(@Payload VotoEncuestaDTO payload) {
        mensajeriaService.votarEncuesta(payload);
    }

    private void validateInboundGroupMessage(MensajeDTO mensajeDTO,
                                             ChatGrupalEntity chat,
                                             Long senderId,
                                             boolean senderKeyPresent,
                                             E2EDiagnosticUtils.ContentDiagnostic inboundDiag,
                                             Set<String> payloadForReceptoresKeys,
                                             String traceId,
                                             Long chatId,
                                             List<Long> expectedRecipientIds) {
        if (!senderKeyPresent) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_SENDER_KEY_MISSING,
                    ExceptionConstants.ERROR_E2E_SENDER_PUBLIC_KEY_MISSING);
        }

        List<Long> activeMemberIds = E2EGroupValidationUtils.activeMemberIds(chat);
        boolean senderIsActiveMember = activeMemberIds.stream().anyMatch(id -> Objects.equals(id, senderId));
        if (!senderIsActiveMember) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_GROUP_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_SENDER_NOT_ACTIVE_GROUP_MEMBER);
        }

        String tipo = mensajeDTO == null ? null : mensajeDTO.getTipo();
        boolean textType = E2EGroupValidationUtils.isTextType(tipo);
        boolean audioType = E2EGroupValidationUtils.isAudioType(tipo);
        boolean imageType = E2EGroupValidationUtils.isImageType(tipo);
        boolean fileType = E2EGroupValidationUtils.isFileType(tipo);
        if (textType && !E2EGroupValidationUtils.hasRequiredE2EGroupFields(inboundDiag)) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_GROUP_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_GROUP_PAYLOAD_INVALID);
        }

        if (textType && !E2EGroupValidationUtils.recipientKeysMatchExactly(chat, senderId, payloadForReceptoresKeys)) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                    ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
        }

        boolean mustValidateGroupAudioPayload = audioType && E2EGroupValidationUtils.isE2EGroupAudio(inboundDiag);
        boolean audioPayloadValid = !mustValidateGroupAudioPayload
                || E2EGroupValidationUtils.hasRequiredE2EGroupAudioFields(mensajeDTO == null ? null : mensajeDTO.getContenido());
        boolean audioRecipientKeysValid = !mustValidateGroupAudioPayload
                || E2EGroupValidationUtils.recipientKeysMatchExactly(chat, senderId, payloadForReceptoresKeys);
        boolean imagePayloadValid = !imageType
                || E2EGroupValidationUtils.hasRequiredE2EGroupImageFields(mensajeDTO == null ? null : mensajeDTO.getContenido());
        boolean imageRecipientKeysValid = !imageType
                || E2EGroupValidationUtils.recipientKeysMatchExactly(chat, senderId, payloadForReceptoresKeys);
        boolean filePayloadValid = !fileType
                || (E2EGroupValidationUtils.hasRequiredE2EGroupFileFields(mensajeDTO == null ? null : mensajeDTO.getContenido())
                && E2EGroupValidationUtils.fileSizeBytesInRange(mensajeDTO == null ? null : mensajeDTO.getContenido(), 1L, maxUploadFileBytes));
        boolean fileRecipientKeysValid = !fileType
                || E2EGroupValidationUtils.recipientKeysMatchExactly(chat, senderId, payloadForReceptoresKeys);
        boolean audioValidateOk = audioPayloadValid && audioRecipientKeysValid;
        String audioRejectReason = "-";
        if (!audioPayloadValid) {
            audioRejectReason = Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID;
        } else if (!audioRecipientKeysValid) {
            audioRejectReason = Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH;
        }
        if (audioType) {
            LOGGER.info(
                    Constantes.LOG_E2E_INBOUND_GROUP_AUDIO_VALIDATE,
                    Instant.now(),
                    traceId,
                    chatId,
                    mensajeDTO == null ? null : mensajeDTO.getId(),
                    senderId,
                    tipo,
                    inboundDiag.getClassification(),
                    inboundDiag.getHash12(),
                    inboundDiag.getForReceptoresKeys(),
                    expectedRecipientIds,
                    payloadForReceptoresKeys,
                    audioValidateOk,
                    audioRejectReason);
        }

        if (mustValidateGroupAudioPayload && !audioPayloadValid) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_GROUP_AUDIO_PAYLOAD_INVALID);
        }
        if (mustValidateGroupAudioPayload && !audioRecipientKeysValid) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH,
                    ExceptionConstants.ERROR_E2E_GROUP_AUDIO_RECIPIENTS_MISMATCH);
        }
        if (imageType && !imagePayloadValid) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_GROUP_IMAGE_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_GROUP_IMAGE_PAYLOAD_INVALID);
        }
        if (imageType && !imageRecipientKeysValid) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                    ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
        }
        if (fileType && !filePayloadValid) {
            LOGGER.warn("[VALIDATION_ERROR] code={} traceId={} tipo={} chatType=GRUPAL",
                    Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                    traceId,
                    Constantes.TIPO_FILE);
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_GROUP_FILE_PAYLOAD_INVALID + " traceId=" + traceId);
        }
        if (fileType && !fileRecipientKeysValid) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                    ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
        }
    }

    private void sendGroupErrorToUser(UsuarioEntity sender,
                                      Long senderId,
                                      Long chatId,
                                      String traceId,
                                      String code,
                                      String message) {
        Map<String, Object> errorPayload = new LinkedHashMap<>();
        errorPayload.put("code", code);
        errorPayload.put("message", message);
        errorPayload.put("traceId", traceId);
        errorPayload.put("chatId", chatId);
        errorPayload.put("senderId", senderId);
        errorPayload.put("ts", Instant.now().toString());

        if (sender != null && sender.getEmail() != null && !sender.getEmail().isBlank()) {
            messagingTemplate.convertAndSendToUser(sender.getEmail(), Constantes.WS_QUEUE_ERRORS, errorPayload);
            return;
        }
        if (senderId != null) {
            messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + senderId + ".errors", errorPayload);
        }
    }

    private Long resolveChatId(MensajeDTO mensajeDTO) {
        if (mensajeDTO == null) {
            return null;
        }
        if (mensajeDTO.getChatId() != null) {
            return mensajeDTO.getChatId();
        }
        return mensajeDTO.getReceptorId();
    }

    private Optional<UsuarioEntity> findActiveGroupMember(ChatGrupalEntity chat, Long userId) {
        if (chat == null || userId == null || chat.getUsuarios() == null) {
            return Optional.empty();
        }
        return chat.getUsuarios().stream()
                .filter(Objects::nonNull)
                .filter(UsuarioEntity::isActivo)
                .filter(u -> Objects.equals(u.getId(), userId))
                .findFirst();
    }

    private Map<String, Object> buildAudioGrabandoPayload(Long emisorId,
                                                          Long chatId,
                                                          boolean grabandoAudio,
                                                          UsuarioEntity emisor) {
        Map<String, Object> payload = new HashMap<>();
        payload.put(Constantes.KEY_EMISOR_ID, emisorId);
        payload.put(Constantes.KEY_CHAT_ID, chatId);
        payload.put(Constantes.KEY_GRABANDO_AUDIO, grabandoAudio);

        if (emisor != null) {
            payload.put(Constantes.KEY_EMISOR_NOMBRE, emisor.getNombre());
            payload.put(Constantes.KEY_EMISOR_APELLIDO, emisor.getApellido());
        }
        return payload;
    }

    @MessageExceptionHandler({IllegalArgumentException.class, AccessDeniedException.class})
    @SendToUser(Constantes.WS_QUEUE_ERRORS)
    public Map<String, Object> handleWsSemanticError(Exception ex) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", ex instanceof AccessDeniedException ? Constantes.ERR_NO_AUTORIZADO : Constantes.ERR_RESPUESTA_INVALIDA);
        payload.put("message", ex.getMessage());
        payload.put("ts", LocalDateTime.now().toString());
        return payload;
    }
}

