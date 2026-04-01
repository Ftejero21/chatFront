package com.chat.chat.Service.MensajeriaService;

import com.chat.chat.DTO.MensajeDestacadoDTO;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MensajeReaccionDTO;
import com.chat.chat.DTO.MensajesDestacadosPageDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.MensajeDestacadoEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.MensajeReaccionEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.ConflictoException;
import com.chat.chat.Exceptions.E2EGroupValidationException;
import com.chat.chat.Exceptions.ReenvioInvalidoException;
import com.chat.chat.Exceptions.ReenvioNoAutorizadoException;
import com.chat.chat.Exceptions.RecursoNoEncontradoException;
import com.chat.chat.Exceptions.RespuestaInvalidaException;
import com.chat.chat.Exceptions.RespuestaNoAutorizadaException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.MensajeDestacadoRepository;
import com.chat.chat.Repository.MensajeReaccionRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.MensajeTemporalAuditoriaRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.ChatService.ChatUserStateService;
import com.chat.chat.Service.EncuestaService.EncuestaService;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.E2EDiagnosticUtils;
import com.chat.chat.Utils.E2EGroupValidationUtils;
import com.chat.chat.Utils.E2EPayloadUtils;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.MessageType;
import com.chat.chat.Utils.ReactionAction;
import com.chat.chat.Utils.SecurityUtils;
import com.chat.chat.Utils.Utils;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.LocalDateTime;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class MensajeriaServiceImpl implements MensajeriaService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajeriaServiceImpl.class);
    private static final long VENTANA_RESTAURACION_DIAS = 3L;
    private static final String MOTIVO_TEMPORAL_EXPIRADO = "TEMPORAL_EXPIRADO";
    private static final int DESTACADOS_DEFAULT_PAGE = 0;
    private static final int DESTACADOS_DEFAULT_SIZE = 10;
    private static final int DESTACADOS_MAX_SIZE = 50;
    private static final String SQL_MENSAJES_COLUMN_EXISTS =
            "SELECT COUNT(1) FROM information_schema.COLUMNS " +
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mensajes' AND COLUMN_NAME = ?";

    @Value(Constantes.PROP_UPLOADS_ROOT)
    private String uploadsRoot;

    @Value(Constantes.PROP_UPLOADS_BASE_URL)
    private String uploadsBaseUrl;

    @Value("${app.uploads.security.max-file-bytes:26214400}")
    private long maxUploadFileBytes;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private MensajeRepository mensajeRepository;

    @Autowired
    private MensajeReaccionRepository mensajeReaccionRepository;

    @Autowired
    private MensajeDestacadoRepository mensajeDestacadoRepository;

    @Autowired
    private MensajeTemporalAuditoriaRepository mensajeTemporalAuditoriaRepository;

    @Autowired
    private ChatIndividualRepository chatIndividualRepository;

    @Autowired
    private ChatGrupalRepository chatGrupalRepository;

    @Autowired
    private SecurityUtils securityUtils;

    @Autowired
    private EncuestaService encuestaService;

    @Autowired
    private ChatUserStateService chatUserStateService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final Map<String, Boolean> mensajesColumnExistsCache = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public MensajeDTO guardarMensajeIndividual(MensajeDTO dto) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        System.out.println(
                Constantes.LOG_GUARDANDO_MSG_INDIVIDUAL + authenticatedUserId + Constantes.LOG_RECEPTOR + dto.getReceptorId());

        UsuarioEntity emisor = usuarioRepository.findById(authenticatedUserId).orElseThrow();
        UsuarioEntity receptor = usuarioRepository.findById(dto.getReceptorId()).orElseThrow();

        ChatIndividualEntity chat = chatIndividualRepository.findFirstByUsuario1AndUsuario2OrderByIdAsc(emisor, receptor)
                .or(() -> chatIndividualRepository.findFirstByUsuario1AndUsuario2OrderByIdAsc(receptor, emisor))
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_CHAT_INDIVIDUAL_NO_ENCONTRADO));

        normalizeReenvio(dto, authenticatedUserId);
        normalizeRespuesta(dto, authenticatedUserId, chat);

        if (emisor.getBloqueados().contains(receptor) || receptor.getBloqueados().contains(emisor)) {
            throw new RuntimeException(Constantes.MSG_NO_PUEDE_ENVIAR_MENSAJES);
        }

        // === AUDIO ===
        if (dto.getAudioDataUrl() != null && dto.getAudioDataUrl().startsWith(Constantes.DATA_AUDIO_PREFIX)) {
            // Guardar a disco (voice/)
            String publicUrl = Utils.saveDataUrlToUploads(dto.getAudioDataUrl(), Constantes.DIR_VOICE, uploadsRoot, uploadsBaseUrl);
            dto.setAudioUrl(publicUrl);
            // inferir mime del dataURL
            String mime = dto.getAudioDataUrl().substring(5, dto.getAudioDataUrl().indexOf(';')); // "audio/webm"
            dto.setAudioMime(mime);
            dto.setTipo(Constantes.TIPO_AUDIO);
        } else if (dto.getAudioUrl() != null && !dto.getAudioUrl().isBlank()) {
            dto.setTipo(Constantes.TIPO_AUDIO);
        } else if (dto.getTipo() == null || dto.getTipo().isBlank()) {
            // si no hay indicios de audio ni tipo explicito, asumimos texto
            dto.setTipo(Constantes.TIPO_TEXT);
        }

        boolean imageType = E2EGroupValidationUtils.isImageType(dto.getTipo());
        boolean fileType = E2EGroupValidationUtils.isFileType(dto.getTipo());
        E2EDiagnosticUtils.ContentDiagnostic inboundDiag = E2EDiagnosticUtils.analyze(dto.getContenido(), dto.getTipo());
        boolean encryptedAudio = E2EGroupValidationUtils.isAudioType(dto.getTipo())
                && E2EGroupValidationUtils.isE2EAudio(inboundDiag);
        if (encryptedAudio && !E2EGroupValidationUtils.hasRequiredE2EAudioFields(dto.getContenido())) {
            LOGGER.warn(
                    Constantes.LOG_E2E_INBOUND_INDIVIDUAL_AUDIO_REJECT,
                    Instant.now(),
                    authenticatedUserId,
                    dto.getReceptorId(),
                    dto.getTipo(),
                    inboundDiag.getClassification(),
                    inboundDiag.getHash12(),
                    Constantes.ERR_E2E_AUDIO_PAYLOAD_INVALID);
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_AUDIO_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_AUDIO_PAYLOAD_INVALID);
        }
        if (imageType && !E2EGroupValidationUtils.hasRequiredE2EImageFields(dto.getContenido())) {
            throw new E2EGroupValidationException(
                    Constantes.ERR_E2E_IMAGE_PAYLOAD_INVALID,
                    ExceptionConstants.ERROR_E2E_IMAGE_PAYLOAD_INVALID);
        }
        if (fileType) {
            boolean validFilePayload = E2EGroupValidationUtils.hasRequiredE2EFileFields(dto.getContenido())
                    && E2EGroupValidationUtils.fileSizeBytesInRange(dto.getContenido(), 1L, maxUploadFileBytes);
            if (!validFilePayload) {
                String traceId = E2EDiagnosticUtils.newTraceId();
                LOGGER.warn("[E2E_FILE_VALIDATION_ERROR] traceId={} chatType=INDIVIDUAL emisorId={} receptorId={} code={}",
                        traceId,
                        authenticatedUserId,
                        dto.getReceptorId(),
                        Constantes.ERR_E2E_FILE_PAYLOAD_INVALID);
                LOGGER.warn("[VALIDATION_ERROR] code={} traceId={} tipo={} chatType=INDIVIDUAL",
                        Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                        traceId,
                        Constantes.TIPO_FILE);
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                        ExceptionConstants.ERROR_E2E_FILE_PAYLOAD_INVALID + " traceId=" + traceId);
            }
        }

        MensajeEntity mensaje = MappingUtils.mensajeDtoAEntity(dto, emisor, receptor);
        if (imageType || fileType) {
            mensaje.setContenido(mensaje.getContenido());
        } else {
            mensaje.setContenido(E2EPayloadUtils.normalizeForStorage(mensaje.getContenido()));
        }
        LocalDateTime fechaEnvio = LocalDateTime.now();
        mensaje.setChat(chat);
        mensaje.setFechaEnvio(fechaEnvio);
        mensaje.setActivo(true);
        mensaje.setLeido(false);
        aplicarConfiguracionMensajeTemporal(dto, mensaje, fechaEnvio);

        MensajeEntity saved = mensajeRepository.save(mensaje);
        reactivateChatForUsers(chat, List.of(emisor, receptor), fechaEnvio);
        return MappingUtils.mensajeEntityADto(saved);
    }

    @Override
    @Transactional
    public MensajeDTO guardarMensajeGrupal(MensajeDTO dto) {
        String traceId = E2EDiagnosticUtils.currentTraceId();
        boolean createdTraceId = false;
        if (traceId == null) {
            traceId = E2EDiagnosticUtils.newTraceId();
            MDC.put(E2EDiagnosticUtils.TRACE_ID_MDC_KEY, traceId);
            createdTraceId = true;
        }

        encuestaService.normalizarPayloadEncuesta(dto);
        Long chatId = dto.getChatId() != null ? dto.getChatId() : dto.getReceptorId();
        E2EDiagnosticUtils.ContentDiagnostic inboundDiag = E2EDiagnosticUtils.analyze(dto.getContenido(), dto.getTipo());

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        try {
            UsuarioEntity emisor = usuarioRepository.findById(authenticatedUserId).orElseThrow();

            // dto.receptorId llega con el id del chat grupal
            ChatGrupalEntity chatGrupal = chatGrupalRepository.findById(chatId)
                    .orElseThrow(() -> new RuntimeException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO));

            List<Long> memberIdsAtSend = E2EGroupValidationUtils.activeMemberIds(chatGrupal);
            List<Long> expectedRecipientIds = E2EGroupValidationUtils.expectedActiveRecipientIds(chatGrupal, authenticatedUserId);
            Set<String> forReceptoresKeysInPayload = E2EDiagnosticUtils.extractForReceptoresKeys(dto.getContenido());
            Set<String> expectedRecipientKeys = expectedRecipientIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            Map<Long, String> recipientPublicKeyFp = new LinkedHashMap<>();
            boolean senderKeyPresent = E2EGroupValidationUtils.hasPublicKey(emisor.getPublicKey());
            boolean textType = E2EGroupValidationUtils.isTextType(dto == null ? null : dto.getTipo());
            boolean audioType = E2EGroupValidationUtils.isAudioType(dto == null ? null : dto.getTipo());
            boolean imageType = E2EGroupValidationUtils.isImageType(dto == null ? null : dto.getTipo());
            boolean fileType = E2EGroupValidationUtils.isFileType(dto == null ? null : dto.getTipo());
            boolean encryptedGroupAudio = audioType && E2EGroupValidationUtils.isE2EGroupAudio(inboundDiag);
            for (Long recipientId : expectedRecipientIds) {
                String recipientKey = usuarioRepository.findFreshById(recipientId)
                        .map(UsuarioEntity::getPublicKey)
                        .orElse(null);
                recipientPublicKeyFp.put(recipientId, E2EDiagnosticUtils.fingerprint12(recipientKey));
            }
            LOGGER.info(
                    Constantes.LOG_E2E_GROUP_RECIPIENTS_BUILD,
                    Instant.now(),
                    traceId,
                    dto.getId(),
                    chatId,
                    authenticatedUserId,
                    memberIdsAtSend,
                    expectedRecipientIds,
                    forReceptoresKeysInPayload,
                    E2EDiagnosticUtils.fingerprint12(emisor.getPublicKey()),
                    recipientPublicKeyFp);

            boolean recipientKeysMatch = expectedRecipientKeys.equals(forReceptoresKeysInPayload);
            boolean groupAudioPayloadValid = !encryptedGroupAudio
                    || E2EGroupValidationUtils.hasRequiredE2EGroupAudioFields(dto.getContenido());
            boolean groupImagePayloadValid = !imageType
                    || E2EGroupValidationUtils.hasRequiredE2EGroupImageFields(dto.getContenido());
            boolean groupFilePayloadValid = !fileType
                    || (E2EGroupValidationUtils.hasRequiredE2EGroupFileFields(dto.getContenido())
                    && E2EGroupValidationUtils.fileSizeBytesInRange(dto.getContenido(), 1L, maxUploadFileBytes));
            boolean groupValidateOk = true;
            String inboundValidateRejectReason = "-";
            if (textType && !recipientKeysMatch) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH;
            }
            if (encryptedGroupAudio && !groupAudioPayloadValid) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID;
            } else if (encryptedGroupAudio && !recipientKeysMatch) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH;
            }
            if (imageType && !groupImagePayloadValid) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_GROUP_IMAGE_PAYLOAD_INVALID;
            } else if (imageType && !recipientKeysMatch) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH;
            }
            if (fileType && !groupFilePayloadValid) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_FILE_PAYLOAD_INVALID;
            } else if (fileType && !recipientKeysMatch) {
                groupValidateOk = false;
                inboundValidateRejectReason = Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH;
            }
            LOGGER.info(Constantes.LOG_E2E_INBOUND_GROUP_VALIDATE,
                    Instant.now(),
                    traceId,
                    chatId,
                    authenticatedUserId,
                    expectedRecipientIds,
                    forReceptoresKeysInPayload,
                    groupValidateOk,
                    inboundValidateRejectReason);
            if (audioType) {
                LOGGER.info(Constantes.LOG_E2E_INBOUND_GROUP_AUDIO_VALIDATE,
                        Instant.now(),
                        traceId,
                        chatId,
                        dto.getId(),
                        authenticatedUserId,
                        dto.getTipo(),
                        inboundDiag.getClassification(),
                        inboundDiag.getHash12(),
                        inboundDiag.getForReceptoresKeys(),
                        expectedRecipientIds,
                        forReceptoresKeysInPayload,
                        !encryptedGroupAudio || groupValidateOk,
                        encryptedGroupAudio ? inboundValidateRejectReason : "-");
            }
            if (encryptedGroupAudio && !groupAudioPayloadValid) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_GROUP_AUDIO_PAYLOAD_INVALID,
                        ExceptionConstants.ERROR_E2E_GROUP_AUDIO_PAYLOAD_INVALID);
            }
            if (textType && !recipientKeysMatch) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                        ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
            }
            if (encryptedGroupAudio && !recipientKeysMatch) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_AUDIO_RECIPIENT_KEYS_MISMATCH,
                        ExceptionConstants.ERROR_E2E_GROUP_AUDIO_RECIPIENTS_MISMATCH);
            }
            if (imageType && !groupImagePayloadValid) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_GROUP_IMAGE_PAYLOAD_INVALID,
                        ExceptionConstants.ERROR_E2E_GROUP_IMAGE_PAYLOAD_INVALID);
            }
            if (imageType && !recipientKeysMatch) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                        ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
            }
            if (fileType && !groupFilePayloadValid) {
                LOGGER.warn("[VALIDATION_ERROR] code={} traceId={} tipo={} chatType=GRUPAL",
                        Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                        traceId,
                        Constantes.TIPO_FILE);
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_FILE_PAYLOAD_INVALID,
                        ExceptionConstants.ERROR_E2E_GROUP_FILE_PAYLOAD_INVALID + " traceId=" + traceId);
            }
            if (fileType && !recipientKeysMatch) {
                throw new E2EGroupValidationException(
                        Constantes.ERR_E2E_RECIPIENT_KEYS_MISMATCH,
                        ExceptionConstants.ERROR_E2E_RECIPIENTS_MISMATCH);
            }

            normalizeReenvio(dto, authenticatedUserId);
            normalizeRespuesta(dto, authenticatedUserId, chatGrupal);

            MensajeEntity mensaje = MappingUtils.mensajeDtoAEntity(dto, emisor, null);
            String rawContent = mensaje.getContenido();
            String normalizedContent = (imageType || fileType) ? rawContent : E2EPayloadUtils.normalizeForStorage(rawContent);
            boolean transformed = !Objects.equals(rawContent, normalizedContent);
            E2EDiagnosticUtils.ContentDiagnostic prePersistDiag = E2EDiagnosticUtils.analyze(
                    normalizedContent,
                    String.valueOf(mensaje.getTipo()));

            if (!senderKeyPresent) {
                LOGGER.warn(
                        Constantes.LOG_E2E_PRE_PERSIST_REJECT,
                        Instant.now(),
                        traceId,
                        chatId,
                        authenticatedUserId,
                        dto.getReceptorId(),
                        mensaje.getTipo(),
                        inboundDiag.getClassification(),
                        inboundDiag.getLength(),
                        inboundDiag.getHash12(),
                        prePersistDiag.getClassification(),
                        prePersistDiag.getLength(),
                        prePersistDiag.getHash12(),
                        transformed,
                        false,
                        expectedRecipientIds,
                        forReceptoresKeysInPayload,
                        Constantes.ERR_E2E_SENDER_KEY_MISSING);
                throw new E2EGroupValidationException(Constantes.ERR_E2E_SENDER_KEY_MISSING, ExceptionConstants.ERROR_E2E_SENDER_PUBLIC_KEY_MISSING);
            }

            LOGGER.info(
                    Constantes.LOG_E2E_PRE_PERSIST,
                    Instant.now(),
                    traceId,
                    chatId,
                    authenticatedUserId,
                    dto.getReceptorId(),
                    mensaje.getTipo(),
                    inboundDiag.getClassification(),
                    inboundDiag.getLength(),
                    inboundDiag.getHash12(),
                    prePersistDiag.getClassification(),
                    prePersistDiag.getLength(),
                    prePersistDiag.getHash12(),
                    transformed,
                    prePersistDiag.hasIv(),
                    prePersistDiag.hasCiphertext(),
                    prePersistDiag.hasForEmisor(),
                    prePersistDiag.hasForReceptores(),
                    prePersistDiag.hasForAdmin(),
                    prePersistDiag.getForReceptoresKeys(),
                    senderKeyPresent,
                    expectedRecipientIds,
                    forReceptoresKeysInPayload,
                    "-");
            if ("INVALID_JSON".equals(inboundDiag.getClassification())) {
                LOGGER.warn(Constantes.LOG_E2E_PRE_PERSIST_PARSE_WARN,
                        Instant.now(), traceId, chatId, dto.getId(), inboundDiag.getParseErrorClass());
            }
            if ("INVALID_JSON".equals(prePersistDiag.getClassification())) {
                LOGGER.warn(Constantes.LOG_E2E_PRE_PERSIST_NORMALIZED_PARSE_WARN,
                        Instant.now(), traceId, chatId, dto.getId(), prePersistDiag.getParseErrorClass());
            }

            mensaje.setContenido(normalizedContent);
            LocalDateTime fechaEnvio = LocalDateTime.now();
            mensaje.setChat(chatGrupal);
            mensaje.setFechaEnvio(fechaEnvio);
            mensaje.setActivo(true);
            mensaje.setLeido(false);
            aplicarConfiguracionMensajeTemporal(dto, mensaje, fechaEnvio);

            MensajeEntity saved = mensajeRepository.save(mensaje);
            reactivateChatForUsers(chatGrupal, chatGrupal.getUsuarios(), fechaEnvio);
            if (encuestaService.esMensajeEncuesta(dto)) {
                encuestaService.crearEncuestaParaMensaje(saved, dto, emisor);
            }
            E2EDiagnosticUtils.ContentDiagnostic postPersistDiag = E2EDiagnosticUtils.analyze(
                    saved.getContenido(),
                    String.valueOf(saved.getTipo()));
            LOGGER.info(
                    Constantes.LOG_E2E_POST_PERSIST,
                    Instant.now(),
                    traceId,
                    chatId,
                    saved.getId(),
                    authenticatedUserId,
                    saved.getTipo(),
                    postPersistDiag.getClassification(),
                    postPersistDiag.getLength(),
                    postPersistDiag.getHash12(),
                    postPersistDiag.hasIv(),
                    postPersistDiag.hasCiphertext(),
                    postPersistDiag.hasForEmisor(),
                    postPersistDiag.hasForReceptores(),
                    postPersistDiag.hasForAdmin(),
                    postPersistDiag.getForReceptoresKeys(),
                    senderKeyPresent,
                    expectedRecipientIds,
                    forReceptoresKeysInPayload,
                    recipientPublicKeyFp);
            if ("INVALID_JSON".equals(postPersistDiag.getClassification())) {
                LOGGER.warn(Constantes.LOG_E2E_POST_PERSIST_PARSE_WARN,
                        Instant.now(), traceId, chatId, saved.getId(), postPersistDiag.getParseErrorClass());
            }

            MensajeDTO out = MappingUtils.mensajeEntityADto(saved);
            encuestaService.enriquecerMensajesConEncuesta(List.of(saved), List.of(out), authenticatedUserId, true);

            // Enriquecer con datos del emisor para que el front no tenga que resolver nada
            out.setEmisorNombre(emisor.getNombre());
            out.setEmisorApellido(emisor.getApellido());
            if (emisor.getFotoUrl() != null) {
                out.setEmisorFoto(Utils.toDataUrlFromUrl(emisor.getFotoUrl(), uploadsRoot)); // o devuelve URL si prefieres
            }
            return out;
        } catch (RuntimeException ex) {
            String rejectReason = ex instanceof E2EGroupValidationException
                    ? ((E2EGroupValidationException) ex).getCode()
                    : "-";
            LOGGER.error(Constantes.LOG_E2E_PERSIST_ERROR,
                    Instant.now(), traceId, chatId, dto.getId(), ex.getClass().getSimpleName(), rejectReason);
            throw ex;
        } finally {
            if (createdTraceId) {
                MDC.remove(E2EDiagnosticUtils.TRACE_ID_MDC_KEY);
            }
        }
    }

    @Override
    @Transactional
    public MensajeDTO votarEncuesta(VotoEncuestaDTO request) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        return encuestaService.votarEncuesta(request, authenticatedUserId);
    }

    @Override
    @Transactional
    public MensajeDTO editarMensajePropio(MensajeDTO dto) {
        if (dto == null || dto.getId() == null) {
            throw new IllegalArgumentException("id de mensaje es obligatorio");
        }
        if (dto.getContenido() == null || dto.getContenido().isBlank()) {
            throw new IllegalArgumentException("contenido es obligatorio");
        }
        if (dto.getTipo() != null && !dto.getTipo().isBlank() && !Constantes.TIPO_TEXT.equalsIgnoreCase(dto.getTipo())) {
            throw new IllegalArgumentException("tipo debe ser TEXT");
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        MensajeEntity mensaje = mensajeRepository.findById(dto.getId())
                .orElseThrow(() -> new IllegalArgumentException("mensaje no existe"));

        Long ownerId = mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId();
        if (!Objects.equals(ownerId, authenticatedUserId)) {
            throw new AccessDeniedException("No puedes editar mensajes de otro usuario");
        }
        if (isMensajeExpirado(mensaje)) {
            throw new IllegalArgumentException("No se puede editar un mensaje expirado");
        }
        if (!mensaje.isActivo()) {
            throw new IllegalArgumentException("No se puede editar un mensaje inactivo");
        }
        if (!Objects.equals(mensaje.getTipo(), MessageType.TEXT)) {
            throw new IllegalArgumentException("Solo se pueden editar mensajes de texto");
        }

        ChatEntity chat = mensaje.getChat();
        if (chat == null || chat.getId() == null) {
            throw new IllegalArgumentException("chat no encontrado para el mensaje");
        }

        if (chat instanceof ChatGrupalEntity) {
            ChatGrupalEntity chatGrupal = chatGrupalRepository.findByIdWithUsuarios(chat.getId())
                    .orElseThrow(() -> new IllegalArgumentException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO));
            if (!chatGrupal.isActivo()) {
                throw new AccessDeniedException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
            }
            boolean senderIsActiveMember = chatGrupal.getUsuarios() != null && chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), authenticatedUserId) && u.isActivo());
            if (!senderIsActiveMember) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
            }
            mensaje.setChat(chatGrupal);
        }

        LocalDateTime editionTimestamp = dto.getEditedAt() != null
                ? dto.getEditedAt()
                : (dto.getFechaEdicion() != null ? dto.getFechaEdicion() : LocalDateTime.now());
        mensaje.setContenido(E2EPayloadUtils.normalizeForStorage(dto.getContenido()));
        mensaje.setEditado(true);
        mensaje.setFechaEdicion(editionTimestamp);

        MensajeEntity saved = mensajeRepository.save(mensaje);
        MensajeDTO out = MappingUtils.mensajeEntityADto(saved);
        out.setEditado(true);
        out.setEdited(true);
        out.setFechaEdicion(editionTimestamp);
        out.setEditedAt(editionTimestamp);
        return out;
    }

    @Override
    @Transactional
    public ReactionDispatchResult procesarReaccion(MensajeReaccionDTO request) {
        validateReaccionRequest(request);

        Long authUserId = securityUtils.getAuthenticatedUserId();
        if (!Objects.equals(authUserId, request.getReactorUserId())) {
            throw new AccessDeniedException("reactorUserId no coincide con el usuario autenticado");
        }

        MensajeEntity mensaje = mensajeRepository.findById(request.getMessageId())
                .orElseThrow(() -> new IllegalArgumentException("messageId no existe"));
        if (isMensajeExpirado(mensaje)) {
            throw new IllegalArgumentException("No se puede reaccionar a un mensaje expirado");
        }
        if (!mensaje.isActivo()) {
            throw new IllegalArgumentException("No se puede reaccionar a un mensaje inactivo");
        }
        if (mensaje.getChat() == null || !Objects.equals(mensaje.getChat().getId(), request.getChatId())) {
            throw new IllegalArgumentException("chatId no coincide con el mensaje");
        }

        UsuarioEntity reactor = usuarioRepository.findById(authUserId)
                .orElseThrow(() -> new IllegalArgumentException("reactorUserId no existe"));
        ReactionAction action = request.actionAsEnumOrNull();
        if (action == null) {
            throw new IllegalArgumentException("action debe ser SET o REMOVE");
        }
        String emojiNormalized = MensajeReaccionDTO.normalizeEmoji(request.getEmoji());

        ChatEntity chat = mensaje.getChat();
        Set<Long> recipients = new LinkedHashSet<>();
        Long targetUserId = null;
        boolean groupChat;

        if (chat instanceof ChatIndividualEntity) {
            ChatIndividualEntity chatIndividual = chatIndividualRepository.findById(chat.getId())
                    .orElseThrow(() -> new IllegalArgumentException("chat individual no existe"));
            Long user1 = chatIndividual.getUsuario1() == null ? null : chatIndividual.getUsuario1().getId();
            Long user2 = chatIndividual.getUsuario2() == null ? null : chatIndividual.getUsuario2().getId();

            boolean reactorBelongs = Objects.equals(user1, authUserId) || Objects.equals(user2, authUserId);
            if (!reactorBelongs) {
                throw new AccessDeniedException("reactor no pertenece al chat individual");
            }

            Long derivedTarget = Objects.equals(authUserId, user1) ? user2 : user1;
            if (request.getTargetUserId() != null && !Objects.equals(request.getTargetUserId(), derivedTarget)) {
                throw new IllegalArgumentException("targetUserId no pertenece al chat individual");
            }
            if (user1 != null) {
                recipients.add(user1);
            }
            if (user2 != null) {
                recipients.add(user2);
            }
            targetUserId = derivedTarget;
            groupChat = false;
        } else if (chat instanceof ChatGrupalEntity) {
            ChatGrupalEntity chatGrupal = chatGrupalRepository.findByIdWithUsuarios(chat.getId())
                    .orElseThrow(() -> new IllegalArgumentException("chat grupal no existe"));
            if (!chatGrupal.isActivo()) {
                throw new IllegalArgumentException("chat grupal inactivo");
            }
            if (request.getTargetUserId() != null) {
                throw new IllegalArgumentException("targetUserId debe ser null en chat grupal");
            }

            boolean reactorBelongs = chatGrupal.getUsuarios() != null && chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), authUserId) && u.isActivo());
            if (!reactorBelongs) {
                throw new AccessDeniedException("reactor no pertenece al grupo");
            }

            if (chatGrupal.getUsuarios() != null) {
                chatGrupal.getUsuarios().stream()
                        .filter(Objects::nonNull)
                        .filter(UsuarioEntity::isActivo)
                        .map(UsuarioEntity::getId)
                        .filter(Objects::nonNull)
                        .forEach(recipients::add);
            }
            targetUserId = null;
            groupChat = true;
        } else {
            throw new IllegalArgumentException("Tipo de chat no soportado para reaccion");
        }

        Optional<MensajeReaccionEntity> existingOpt = mensajeReaccionRepository
                .findByMensajeIdAndUsuarioId(mensaje.getId(), authUserId);

        String normalizedAction = action.name();
        String normalizedEmojiOut = null;
        LocalDateTime createdAt = null;

        if (action == ReactionAction.SET) {
            if (emojiNormalized == null) {
                throw new IllegalArgumentException("emoji es obligatorio para action=SET");
            }
            if (existingOpt.isPresent()) {
                MensajeReaccionEntity existing = existingOpt.get();
                if (Objects.equals(existing.getEmoji(), emojiNormalized)) {
                    normalizedEmojiOut = existing.getEmoji();
                    createdAt = existing.getUpdatedAt() != null ? existing.getUpdatedAt() : existing.getCreatedAt();
                } else {
                    existing.setEmoji(emojiNormalized);
                    MensajeReaccionEntity saved = mensajeReaccionRepository.save(existing);
                    normalizedEmojiOut = saved.getEmoji();
                    createdAt = saved.getUpdatedAt() != null ? saved.getUpdatedAt() : saved.getCreatedAt();
                }
            } else {
                MensajeReaccionEntity entity = new MensajeReaccionEntity();
                entity.setMensaje(mensaje);
                entity.setUsuario(reactor);
                entity.setEmoji(emojiNormalized);
                MensajeReaccionEntity saved = mensajeReaccionRepository.save(entity);
                normalizedEmojiOut = saved.getEmoji();
                createdAt = saved.getUpdatedAt() != null ? saved.getUpdatedAt() : saved.getCreatedAt();
            }
        } else {
            existingOpt.ifPresent(mensajeReaccionRepository::delete);
            normalizedAction = ReactionAction.REMOVE.name();
            normalizedEmojiOut = null;
            createdAt = null;
        }

        MensajeReaccionDTO event = new MensajeReaccionDTO();
        event.setEvent(MensajeReaccionDTO.EVENT_MESSAGE_REACTION);
        event.setMessageId(mensaje.getId());
        event.setChatId(chat.getId());
        event.setEsGrupo(groupChat);
        event.setReactorUserId(authUserId);
        event.setTargetUserId(targetUserId);
        event.setEmoji(normalizedEmojiOut);
        event.setAction(normalizedAction);
        event.setCreatedAt(createdAt);

        return new ReactionDispatchResult(event, recipients, chat.getId(), groupChat);
    }

    @Override
    @Transactional
    public void marcarMensajesComoLeidos(List<Long> ids) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (ids == null || ids.isEmpty()) {
            LOGGER.info(Constantes.LOG_WS_MARK_READ_NO_MSG, ids);
            return;
        }

        List<Long> uniqueIds = new java.util.ArrayList<>(new LinkedHashSet<>(ids));
        int updated = mensajeRepository.markLeidoByIdsAndReceptorId(uniqueIds, authenticatedUserId);
        if (updated <= 0) {
            LOGGER.info(Constantes.LOG_WS_MARK_READ_NO_MSG, uniqueIds);
            return;
        }

        List<MensajeEntity> mensajes = mensajeRepository.findByIdInAndReceptorId(uniqueIds, authenticatedUserId);
        if (mensajes == null || mensajes.isEmpty()) {
            LOGGER.info(Constantes.LOG_WS_MARK_READ_NO_MSG, uniqueIds);
            return;
        }

        // Notificar por WebSocket al emisor de cada mensaje
        mensajes.forEach(mensaje -> {
            if (mensaje.getEmisor() == null || mensaje.getEmisor().getId() == null) {
                LOGGER.warn(Constantes.LOG_WS_MARK_READ_NO_EMISOR, mensaje.getId());
                return;
            }
            Long emisorId = mensaje.getEmisor().getId();
            Map<String, Long> payload = new HashMap<>();
            payload.put(Constantes.KEY_MENSAJE_ID, mensaje.getId());

            messagingTemplate.convertAndSend(Constantes.WS_TOPIC_LEIDO + emisorId, payload);
            LOGGER.info(Constantes.LOG_WS_SEND_LEIDO, emisorId, mensaje.getId());
        });
    }

    @Override
    @Transactional
    public void destacarMensaje(Long mensajeId) {
        LOGGER.info("[DESTACADOS_SVC] op=DESTACAR stage=START mensajeId={}", mensajeId);
        if (mensajeId == null) {
            throw new IllegalArgumentException("mensajeId es obligatorio");
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        LOGGER.info("[DESTACADOS_SVC] op=DESTACAR stage=AUTH_OK userId={} mensajeId={}",
                authenticatedUserId,
                mensajeId);
        MensajeEntity mensaje = mensajeRepository.findById(mensajeId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mensaje no encontrado: " + mensajeId));
        validarPermisoParaDestacado(mensaje, authenticatedUserId, true);

        if (mensajeDestacadoRepository.existsByUsuarioIdAndMensajeId(authenticatedUserId, mensajeId)) {
            LOGGER.info("[DESTACADOS_SVC] op=DESTACAR stage=IDEMPOTENT userId={} mensajeId={}",
                    authenticatedUserId,
                    mensajeId);
            return;
        }

        UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_AUTENTICADO_NO_ENCONTRADO));

        MensajeDestacadoEntity destacado = new MensajeDestacadoEntity();
        destacado.setUsuario(usuario);
        destacado.setMensaje(mensaje);

        try {
            mensajeDestacadoRepository.save(destacado);
            LOGGER.info("[DESTACADOS_SVC] op=DESTACAR stage=END status=CREATED userId={} mensajeId={}",
                    authenticatedUserId,
                    mensajeId);
        } catch (DataIntegrityViolationException ex) {
            LOGGER.debug("[DESTACADO] duplicado concurrente ignorado usuarioId={} mensajeId={}",
                    authenticatedUserId,
                    mensajeId);
        }
    }

    @Override
    @Transactional
    public void quitarDestacado(Long mensajeId) {
        LOGGER.info("[DESTACADOS_SVC] op=QUITAR stage=START mensajeId={}", mensajeId);
        if (mensajeId == null) {
            throw new IllegalArgumentException("mensajeId es obligatorio");
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        LOGGER.info("[DESTACADOS_SVC] op=QUITAR stage=AUTH_OK userId={} mensajeId={}",
                authenticatedUserId,
                mensajeId);
        MensajeEntity mensaje = mensajeRepository.findById(mensajeId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mensaje no encontrado: " + mensajeId));
        validarPermisoParaDestacado(mensaje, authenticatedUserId, false);

        mensajeDestacadoRepository.deleteByUsuarioIdAndMensajeId(authenticatedUserId, mensajeId);
        LOGGER.info("[DESTACADOS_SVC] op=QUITAR stage=END status=DELETED userId={} mensajeId={}",
                authenticatedUserId,
                mensajeId);
    }

    @Override
    @Transactional
    public MensajesDestacadosPageDTO listarMensajesDestacadosUsuario(Integer page, Integer size, String sort) {
        int safePage = page == null ? DESTACADOS_DEFAULT_PAGE : Math.max(DESTACADOS_DEFAULT_PAGE, page);
        int requestedSize = size == null ? DESTACADOS_DEFAULT_SIZE : size;
        int safeSize = Math.max(1, Math.min(DESTACADOS_MAX_SIZE, requestedSize));
        LOGGER.info("[DESTACADOS_SVC] op=LISTAR stage=START page={} size={} sort={}",
                safePage,
                safeSize,
                sort);
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        LOGGER.info("[DESTACADOS_SVC] op=LISTAR stage=AUTH_OK userId={} page={} size={}",
                authenticatedUserId,
                safePage,
                safeSize);
        if (sort != null && !sort.isBlank()) {
            LOGGER.debug("[DESTACADOS] sort param recibido='{}' (se mantiene orden de negocio por fecha de mensaje)", sort);
        }
        Pageable pageable = PageRequest.of(safePage, safeSize);

        Page<MensajeDestacadoRepository.DestacadoRow> pageResult =
                mensajeDestacadoRepository.findDestacadosRowsByUsuarioId(authenticatedUserId, pageable);
        LOGGER.info("[DESTACADOS_SVC] op=LISTAR stage=QUERY_OK userId={} totalElements={} returned={}",
                authenticatedUserId,
                pageResult.getTotalElements(),
                pageResult.getNumberOfElements());

        List<MensajeDestacadoDTO> content = new ArrayList<>();
        for (MensajeDestacadoRepository.DestacadoRow row : pageResult.getContent()) {
            content.add(mapDestacadoDto(row));
        }

        MensajesDestacadosPageDTO response = new MensajesDestacadosPageDTO();
        response.setContent(content);
        response.setPage(pageResult.getNumber());
        response.setSize(pageResult.getSize());
        response.setTotalElements(pageResult.getTotalElements());
        response.setTotalPages(pageResult.getTotalPages());
        response.setHasNext(pageResult.hasNext());
        response.setHasPrevious(pageResult.hasPrevious());
        LOGGER.info("[DESTACADOS_SVC] op=LISTAR stage=END userId={} page={} size={} total={} hasNext={} hasPrevious={}",
                authenticatedUserId,
                response.getPage(),
                response.getSize(),
                response.getTotalElements(),
                response.isHasNext(),
                response.isHasPrevious());
        return response;
    }

    private MensajesDestacadosPageDTO buildEmptyDestacadosPage(int page, int size) {
        MensajesDestacadosPageDTO response = new MensajesDestacadosPageDTO();
        response.setContent(List.of());
        response.setPage(page);
        response.setSize(size);
        response.setTotalElements(0L);
        response.setTotalPages(0);
        response.setHasNext(false);
        response.setHasPrevious(page > 0);
        return response;
    }

    private MensajeDestacadoDTO mapDestacadoDto(MensajeDestacadoRepository.DestacadoRow row) {
        MensajeDestacadoDTO dto = new MensajeDestacadoDTO();
        dto.setMensajeId(row.getMensajeId());
        dto.setChatId(row.getChatId());
        dto.setEmisorId(row.getEmisorId());
        dto.setTipoMensaje(row.getTipoMensaje() == null ? MessageType.TEXT.name() : row.getTipoMensaje());
        dto.setFechaMensaje(row.getFechaMensaje() != null ? row.getFechaMensaje() : row.getDestacadoEn());
        dto.setDestacadoEn(row.getDestacadoEn());
        dto.setPreview(buildPreviewDestacado(row));
        dto.setNombreChat(row.getNombreGrupo());
        dto.setNombreEmisor(row.getEmisorNombre());
        dto.setNombreEmisorCompleto(buildNombreCompleto(row.getEmisorNombre(), row.getEmisorApellido()));
        return dto;
    }

    private String buildPreviewDestacado(MensajeDestacadoRepository.DestacadoRow row) {
        if (row == null) {
            return Constantes.MSG_SIN_DATOS;
        }
        if (isMensajeExpirado(row.getExpiraEn())) {
            return buildPlaceholderTemporal(row.getPlaceholderTexto(), row.getMensajeTemporalSegundos());
        }
        if (Boolean.FALSE.equals(row.getActivo())) {
            return "Mensaje eliminado";
        }

        MessageType tipo;
        try {
            tipo = row.getTipoMensaje() == null ? MessageType.TEXT : MessageType.valueOf(row.getTipoMensaje().toUpperCase());
        } catch (Exception ex) {
            tipo = MessageType.TEXT;
        }
        if (tipo == MessageType.IMAGE) {
            return "Imagen";
        }
        if (tipo == MessageType.VIDEO) {
            return "Video";
        }
        if (tipo == MessageType.AUDIO) {
            String dur = Utils.mmss(row.getMediaDuracionMs());
            return dur == null || dur.isBlank() ? "Audio" : "Audio (" + dur + ")";
        }
        if (tipo == MessageType.FILE) {
            String nombreArchivo = extractFileName(row.getMediaUrl());
            return nombreArchivo == null || nombreArchivo.isBlank() ? "Archivo" : "Archivo: " + nombreArchivo;
        }
        if (tipo == MessageType.POLL) {
            return "Encuesta";
        }
        if (isEncryptedPayload(row.getContenido())) {
            return "Mensaje cifrado";
        }
        return Utils.truncarSafe(row.getContenido(), 160);
    }

    private boolean isMensajeExpirado(LocalDateTime expiraEn) {
        if (expiraEn == null) {
            return false;
        }
        return !expiraEn.isAfter(LocalDateTime.now());
    }

    private String buildPlaceholderTemporal(String placeholderTexto, Long mensajeTemporalSegundos) {
        if (placeholderTexto != null && !placeholderTexto.isBlank()) {
            return placeholderTexto;
        }
        return Utils.construirPlaceholderTemporal(mensajeTemporalSegundos);
    }

    @Override
    @Transactional
    public boolean eliminarMensajePropio(MensajeDTO mensajeDTO) {
        if (mensajeDTO == null || mensajeDTO.getId() == null) {
            LOGGER.warn(Constantes.LOG_WS_DELETE_INVALID);
            return false;
        }
        try {
            MensajeDTO eliminado = eliminarMensajePropio(mensajeDTO.getId(), mensajeDTO.getMotivoEliminacion());
            return eliminado != null && !eliminado.isActivo();
        } catch (RuntimeException ex) {
            LOGGER.warn("[DELETE] no se pudo eliminar mensaje id={} motivo={} error={}",
                    mensajeDTO.getId(),
                    mensajeDTO.getMotivoEliminacion(),
                    ex.getClass().getSimpleName());
            return false;
        }
    }

    @Override
    @Transactional
    public MensajeDTO eliminarMensajePropio(Long mensajeId, String motivoEliminacion) {
        if (mensajeId == null) {
            throw new IllegalArgumentException("mensajeId es obligatorio");
        }
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();

        MensajeEntity mensaje = mensajeRepository.findById(mensajeId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mensaje no encontrado: " + mensajeId));
        Long ownerId = mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId();
        if (!Objects.equals(ownerId, authenticatedUserId)) {
            throw new AccessDeniedException("No puedes eliminar mensajes de otro usuario");
        }
        if (!mensaje.isActivo()) {
            throw new ConflictoException("El mensaje ya estaba eliminado");
        }
        if (isMensajeExpirado(mensaje)) {
            throw new ConflictoException("No se puede eliminar un mensaje temporal expirado");
        }

        ChatDispatchContext dispatchContext = resolveChatDispatchContext(mensaje.getChat(), authenticatedUserId);

        mensaje.setActivo(false);
        mensaje.setFechaEliminacion(nowUtc());
        mensaje.setMotivoEliminacion(normalizeNullableText(motivoEliminacion));

        MensajeEntity saved = mensajeRepository.save(mensaje);
        syncLegacyDeleteColumns(saved.getId(), saved.getFechaEliminacion());
        MensajeDTO out = MappingUtils.mensajeEntityADto(saved);
        broadcastMensaje(out, dispatchContext);
        return out;
    }

    @Override
    @Transactional
    public MensajeDTO restaurarMensajePropio(Long mensajeId) {
        if (mensajeId == null) {
            throw new IllegalArgumentException("mensajeId es obligatorio");
        }

        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        MensajeEntity mensaje = mensajeRepository.findById(mensajeId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mensaje no encontrado: " + mensajeId));

        Long ownerId = mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId();
        if (!Objects.equals(ownerId, authenticatedUserId)) {
            throw new AccessDeniedException("No puedes restaurar mensajes de otro usuario");
        }
        if (mensaje.isActivo()) {
            throw new AccessDeniedException("Solo se pueden restaurar mensajes eliminados");
        }

        if (MOTIVO_TEMPORAL_EXPIRADO.equalsIgnoreCase(mensaje.getMotivoEliminacion()) || isMensajeExpirado(mensaje)) {
            throw new ConflictoException("No se puede restaurar un mensaje temporal expirado");
        }

        LocalDateTime fechaEliminacion = resolveDeleteTimestamp(mensaje);
        LocalDateTime limiteRestauracion = fechaEliminacion.plusDays(VENTANA_RESTAURACION_DIAS);
        if (nowUtc().isAfter(limiteRestauracion)) {
            throw new ConflictoException(
                    Constantes.ERR_RESTORE_WINDOW_EXPIRED,
                    "Ventana de restauracion vencida. Limite UTC: " + limiteRestauracion);
        }

        ChatDispatchContext dispatchContext = resolveChatDispatchContext(mensaje.getChat(), authenticatedUserId);

        mensaje.setActivo(true);
        mensaje.setMotivoEliminacion(null);
        mensaje.setPlaceholderTexto(null);
        mensaje.setFechaEliminacion(null);

        MensajeEntity saved = mensajeRepository.save(mensaje);
        clearLegacyDeleteColumns(saved.getId());
        MensajeDTO restored = MappingUtils.mensajeEntityADto(saved);

        broadcastMensaje(restored, dispatchContext);
        return restored;
    }

    private void validateReaccionRequest(MensajeReaccionDTO request) {
        if (request == null) {
            throw new IllegalArgumentException("payload de reaccion vacio");
        }
        List<String> errors = new ArrayList<>(request.validarEntrada());
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Payload de reaccion invalido: " + String.join("; ", errors));
        }
    }

    private void normalizeReenvio(MensajeDTO dto, Long authenticatedUserId) {
        if (dto == null) {
            return;
        }
        if (dto.isReenviado()) {
            Long originalId = dto.getMensajeOriginalId();
            if (originalId == null) {
                throw new ReenvioInvalidoException(ExceptionConstants.ERROR_REENVIO_ID_REQUERIDO);
            }
            MensajeEntity original = mensajeRepository.findById(originalId)
                    .orElseThrow(() -> new ReenvioInvalidoException(
                            ExceptionConstants.ERROR_REENVIO_ORIGINAL_NO_EXISTE + originalId));
            if (isMensajeExpirado(original)) {
                throw new ReenvioInvalidoException(ExceptionConstants.ERROR_REENVIO_ORIGINAL_NO_EXISTE + originalId);
            }
            UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId).orElseThrow();
            if (!canAccessChat(usuario, original.getChat())) {
                throw new ReenvioNoAutorizadoException(ExceptionConstants.ERROR_REENVIO_NO_AUTORIZADO);
            }
        } else {
            dto.setMensajeOriginalId(null);
        }
    }

    private void normalizeRespuesta(MensajeDTO dto, Long authenticatedUserId, ChatEntity chatDestino) {
        if (dto == null) {
            return;
        }
        Long replyId = dto.getReplyToMessageId();
        if (replyId == null) {
            dto.setReplySnippet(null);
            dto.setReplyAuthorName(null);
            return;
        }

        MensajeEntity original = mensajeRepository.findById(replyId)
                .orElseThrow(() -> new RespuestaInvalidaException(ExceptionConstants.ERROR_RESPUESTA_INVALIDA));

        if (isMensajeExpirado(original)) {
            throw new RespuestaInvalidaException(ExceptionConstants.ERROR_RESPUESTA_INVALIDA);
        }

        if (!original.isActivo()) {
            throw new RespuestaInvalidaException(ExceptionConstants.ERROR_RESPUESTA_INVALIDA);
        }

        UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId).orElseThrow();
        if (!canAccessChat(usuario, original.getChat())) {
            throw new RespuestaNoAutorizadaException(ExceptionConstants.ERROR_RESPUESTA_NO_AUTORIZADA);
        }

        if (original.getChat() == null || chatDestino == null
                || !Objects.equals(original.getChat().getId(), chatDestino.getId())) {
            throw new RespuestaInvalidaException(ExceptionConstants.ERROR_RESPUESTA_INVALIDA);
        }

    }

    private void aplicarConfiguracionMensajeTemporal(MensajeDTO dto, MensajeEntity mensaje, LocalDateTime fechaEnvio) {
        if (mensaje == null) {
            return;
        }
        Long segundosTemporales = dto == null ? null : dto.getMensajeTemporalSegundos();
        boolean temporalActivo = dto != null
                && Boolean.TRUE.equals(dto.getMensajeTemporal())
                && segundosTemporales != null
                && segundosTemporales > 0;

        if (!temporalActivo) {
            mensaje.setMensajeTemporal(false);
            mensaje.setMensajeTemporalSegundos(null);
            mensaje.setExpiraEn(null);
            return;
        }

        LocalDateTime base = fechaEnvio != null ? fechaEnvio : LocalDateTime.now();
        mensaje.setMensajeTemporal(true);
        mensaje.setMensajeTemporalSegundos(segundosTemporales);
        mensaje.setExpiraEn(base.plusSeconds(segundosTemporales));
    }

    private void validarPermisoParaDestacado(MensajeEntity mensaje,
                                             Long authenticatedUserId,
                                             boolean validarMensajeRecibido) {
        if (mensaje == null || !usuarioPerteneceAlChat(authenticatedUserId, mensaje.getChat())) {
            throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_CHAT);
        }
        if (!validarMensajeRecibido) {
            return;
        }
        Long emisorId = mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId();
        if (Objects.equals(emisorId, authenticatedUserId)) {
            throw new AccessDeniedException(Constantes.MSG_SOLO_MENSAJES_RECIBIDOS_DESTACAR);
        }
    }

    private boolean usuarioPerteneceAlChat(Long authenticatedUserId, ChatEntity chat) {
        if (authenticatedUserId == null || chat == null) {
            return false;
        }
        if (chat instanceof ChatIndividualEntity chatIndividual) {
            Long user1Id = chatIndividual.getUsuario1() == null ? null : chatIndividual.getUsuario1().getId();
            Long user2Id = chatIndividual.getUsuario2() == null ? null : chatIndividual.getUsuario2().getId();
            return Objects.equals(user1Id, authenticatedUserId) || Objects.equals(user2Id, authenticatedUserId);
        }
        if (chat instanceof ChatGrupalEntity chatGrupal) {
            if (!chatGrupal.isActivo()) {
                return false;
            }
            return chatGrupal.getUsuarios() != null && chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), authenticatedUserId) && u.isActivo());
        }
        return false;
    }

    private MensajeDestacadoDTO mapDestacadoDto(MensajeDestacadoEntity destacado) {
        MensajeEntity mensaje = destacado.getMensaje();

        MensajeDestacadoDTO dto = new MensajeDestacadoDTO();
        dto.setMensajeId(mensaje.getId());
        dto.setChatId(mensaje.getChat() == null ? null : mensaje.getChat().getId());
        dto.setEmisorId(mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId());
        dto.setTipoMensaje(mensaje.getTipo() == null ? MessageType.TEXT.name() : mensaje.getTipo().name());
        dto.setFechaMensaje(mensaje.getFechaEnvio() != null ? mensaje.getFechaEnvio() : destacado.getCreatedAt());
        dto.setDestacadoEn(destacado.getCreatedAt());
        dto.setPreview(buildPreviewDestacado(mensaje));

        if (mensaje.getChat() instanceof ChatGrupalEntity chatGrupal) {
            dto.setNombreChat(chatGrupal.getNombreGrupo());
        }

        if (mensaje.getEmisor() != null) {
            String nombre = mensaje.getEmisor().getNombre();
            String apellido = mensaje.getEmisor().getApellido();
            dto.setNombreEmisor(nombre);
            dto.setNombreEmisorCompleto(buildNombreCompleto(nombre, apellido));
        }
        return dto;
    }

    private String buildPreviewDestacado(MensajeEntity mensaje) {
        if (mensaje == null) {
            return Constantes.MSG_SIN_DATOS;
        }
        if (isMensajeExpirado(mensaje)) {
            return buildPlaceholderTemporal(mensaje);
        }

        MessageType tipo = mensaje.getTipo() == null ? MessageType.TEXT : mensaje.getTipo();
        if (tipo == MessageType.IMAGE) {
            return "Imagen";
        }
        if (tipo == MessageType.VIDEO) {
            return "Video";
        }
        if (tipo == MessageType.AUDIO) {
            String dur = Utils.mmss(mensaje.getMediaDuracionMs());
            return dur == null || dur.isBlank() ? "Audio" : "Audio (" + dur + ")";
        }
        if (tipo == MessageType.FILE) {
            String nombreArchivo = extractFileName(mensaje.getMediaUrl());
            return nombreArchivo == null || nombreArchivo.isBlank() ? "Archivo" : "Archivo: " + nombreArchivo;
        }
        if (tipo == MessageType.POLL) {
            return "Encuesta";
        }
        if (isEncryptedPayload(mensaje.getContenido())) {
            return "Mensaje cifrado";
        }
        return Utils.truncarSafe(mensaje.getContenido(), 160);
    }

    private String buildPlaceholderTemporal(MensajeEntity mensaje) {
        if (mensaje == null) {
            return Utils.construirPlaceholderTemporal(null);
        }
        if (mensaje.getPlaceholderTexto() != null && !mensaje.getPlaceholderTexto().isBlank()) {
            return mensaje.getPlaceholderTexto();
        }
        return Utils.construirPlaceholderTemporal(mensaje.getMensajeTemporalSegundos());
    }

    private boolean isEncryptedPayload(String contenido) {
        if (contenido == null || contenido.isBlank()) {
            return false;
        }
        String classification = E2EDiagnosticUtils.analyze(contenido).getClassification();
        return classification != null && classification.startsWith("JSON_E2E");
    }

    private String extractFileName(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        int slash = url.lastIndexOf('/');
        return (slash >= 0 && slash + 1 < url.length()) ? url.substring(slash + 1) : url;
    }

    private String buildNombreCompleto(String nombre, String apellido) {
        String n = nombre == null ? "" : nombre.trim();
        String a = apellido == null ? "" : apellido.trim();
        String fullName = (n + (a.isEmpty() ? "" : " " + a)).trim();
        return fullName.isEmpty() ? null : fullName;
    }

    private boolean isMensajeExpirado(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getExpiraEn() == null) {
            return false;
        }
        return !mensaje.getExpiraEn().isAfter(LocalDateTime.now());
    }

    private boolean canAccessChat(UsuarioEntity usuario, ChatEntity chat) {
        if (usuario == null || chat == null || usuario.getId() == null) {
            return false;
        }
        if (chat instanceof ChatIndividualEntity) {
            ChatIndividualEntity ci = (ChatIndividualEntity) chat;
            Long userId = usuario.getId();
            return (ci.getUsuario1() != null && Objects.equals(ci.getUsuario1().getId(), userId))
                    || (ci.getUsuario2() != null && Objects.equals(ci.getUsuario2().getId(), userId));
        }
        if (chat instanceof ChatGrupalEntity) {
            ChatGrupalEntity cg = (ChatGrupalEntity) chat;
            return cg.getUsuarios() != null
                    && cg.getUsuarios().stream().anyMatch(u -> Objects.equals(u.getId(), usuario.getId()));
        }
        return false;
    }

    private ChatDispatchContext resolveChatDispatchContext(ChatEntity chat, Long authenticatedUserId) {
        if (chat == null || chat.getId() == null) {
            throw new RecursoNoEncontradoException("chat no encontrado para el mensaje");
        }

        if (chat instanceof ChatIndividualEntity) {
            ChatIndividualEntity chatIndividual = chatIndividualRepository.findById(chat.getId())
                    .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_CHAT_INDIVIDUAL_NO_ENCONTRADO));

            Long user1 = chatIndividual.getUsuario1() == null ? null : chatIndividual.getUsuario1().getId();
            Long user2 = chatIndividual.getUsuario2() == null ? null : chatIndividual.getUsuario2().getId();
            boolean belongs = Objects.equals(user1, authenticatedUserId) || Objects.equals(user2, authenticatedUserId);
            if (!belongs) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_CHAT);
            }

            Set<Long> recipients = new LinkedHashSet<>();
            if (user1 != null) {
                recipients.add(user1);
            }
            if (user2 != null) {
                recipients.add(user2);
            }
            return new ChatDispatchContext(false, chatIndividual.getId(), recipients);
        }

        if (chat instanceof ChatGrupalEntity) {
            ChatGrupalEntity chatGrupal = chatGrupalRepository.findByIdWithUsuarios(chat.getId())
                    .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO));
            if (!chatGrupal.isActivo()) {
                throw new RecursoNoEncontradoException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
            }

            boolean senderIsActiveMember = chatGrupal.getUsuarios() != null && chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), authenticatedUserId) && u.isActivo());
            if (!senderIsActiveMember) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
            }

            Set<Long> recipients = new LinkedHashSet<>();
            if (chatGrupal.getUsuarios() != null) {
                chatGrupal.getUsuarios().stream()
                        .filter(Objects::nonNull)
                        .filter(UsuarioEntity::isActivo)
                        .map(UsuarioEntity::getId)
                        .filter(Objects::nonNull)
                        .forEach(recipients::add);
            }
            return new ChatDispatchContext(true, chatGrupal.getId(), recipients);
        }

        throw new RecursoNoEncontradoException("Tipo de chat no soportado para operacion de mensaje");
    }

    private LocalDateTime resolveDeleteTimestamp(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getId() == null) {
            throw new RecursoNoEncontradoException("Mensaje no encontrado");
        }

        if (mensaje.getFechaEliminacion() != null) {
            return mensaje.getFechaEliminacion();
        }

        LocalDateTime legacyDeletedAt = resolveLegacyDeletedTimestamp(mensaje.getId());
        if (legacyDeletedAt != null) {
            return legacyDeletedAt;
        }

        LocalDateTime legacyUpdatedAt = resolveLegacyUpdatedAtTimestampForDeleteAudit(mensaje);
        if (legacyUpdatedAt != null) {
            return legacyUpdatedAt;
        }

        throw new ConflictoException(
                Constantes.ERR_DELETE_TIMESTAMP_MISSING,
                "No se puede restaurar: falta timestamp de eliminacion para mensaje legacy");
    }

    private LocalDateTime resolveLegacyDeletedTimestamp(Long mensajeId) {
        LocalDateTime deletedAt = queryLegacyTimestampIfColumnExists("deleted_at", mensajeId);
        if (deletedAt != null) {
            return deletedAt;
        }
        return queryLegacyTimestampIfColumnExists("deletedAt", mensajeId);
    }

    private LocalDateTime resolveLegacyUpdatedAtTimestampForDeleteAudit(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getId() == null || mensaje.isActivo()) {
            return null;
        }
        if (MOTIVO_TEMPORAL_EXPIRADO.equalsIgnoreCase(mensaje.getMotivoEliminacion())) {
            return null;
        }
        if (mensajeTemporalAuditoriaRepository.findByMensajeId(mensaje.getId()).isEmpty()) {
            return null;
        }

        LocalDateTime updatedAt = queryLegacyTimestampIfColumnExists("updated_at", mensaje.getId());
        if (updatedAt == null) {
            updatedAt = queryLegacyTimestampIfColumnExists("updatedAt", mensaje.getId());
        }
        if (updatedAt == null) {
            return null;
        }
        if (mensaje.getFechaEnvio() != null && updatedAt.isBefore(mensaje.getFechaEnvio())) {
            return null;
        }
        return updatedAt;
    }

    private LocalDateTime queryLegacyTimestampIfColumnExists(String columnName, Long mensajeId) {
        if (columnName == null || columnName.isBlank() || mensajeId == null) {
            return null;
        }
        if (!mensajesColumnExists(columnName)) {
            return null;
        }

        String sql = "SELECT " + columnName + " FROM mensajes WHERE id = ?";
        return jdbcTemplate.query(sql, rs -> {
            if (!rs.next()) {
                return null;
            }
            java.sql.Timestamp timestamp = rs.getTimestamp(1);
            return timestamp == null ? null : timestamp.toLocalDateTime();
        }, mensajeId);
    }

    private boolean mensajesColumnExists(String columnName) {
        return mensajesColumnExistsCache.computeIfAbsent(columnName, key -> {
            Integer count = jdbcTemplate.queryForObject(SQL_MENSAJES_COLUMN_EXISTS, Integer.class, key);
            return count != null && count > 0;
        });
    }

    private void syncLegacyDeleteColumns(Long mensajeId, LocalDateTime timestampUtc) {
        if (mensajeId == null || timestampUtc == null) {
            return;
        }
        Timestamp ts = Timestamp.valueOf(timestampUtc);
        if (mensajesColumnExists("deleted_at")) {
            jdbcTemplate.update("UPDATE mensajes SET deleted_at = ? WHERE id = ?", ts, mensajeId);
        }
        if (mensajesColumnExists("deletedAt")) {
            jdbcTemplate.update("UPDATE mensajes SET deletedAt = ? WHERE id = ?", ts, mensajeId);
        }
    }

    private void clearLegacyDeleteColumns(Long mensajeId) {
        if (mensajeId == null) {
            return;
        }
        if (mensajesColumnExists("deleted_at")) {
            jdbcTemplate.update("UPDATE mensajes SET deleted_at = NULL WHERE id = ?", mensajeId);
        }
        if (mensajesColumnExists("deletedAt")) {
            jdbcTemplate.update("UPDATE mensajes SET deletedAt = NULL WHERE id = ?", mensajeId);
        }
    }

    private void reactivateChatForUsers(ChatEntity chat, List<UsuarioEntity> users, LocalDateTime now) {
        if (chat == null || chat.getId() == null || users == null || users.isEmpty()) {
            return;
        }
        LocalDateTime effectiveNow = now == null ? nowUtc() : now;
        for (UsuarioEntity user : users) {
            if (user == null || user.getId() == null) {
                continue;
            }
            if (chat instanceof ChatGrupalEntity && !user.isActivo()) {
                continue;
            }
            chatUserStateService.reactivateChat(chat, user, effectiveNow);
        }
    }

    private LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private void broadcastMensaje(MensajeDTO mensaje, ChatDispatchContext dispatchContext) {
        if (mensaje == null || dispatchContext == null) {
            return;
        }
        if (dispatchContext.groupChat()) {
            messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_GRUPAL + dispatchContext.chatId(), mensaje);
            return;
        }
        for (Long userId : dispatchContext.recipients()) {
            if (userId == null) {
                continue;
            }
            messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + userId, mensaje);
        }
    }

    private record ChatDispatchContext(boolean groupChat, Long chatId, Set<Long> recipients) {
    }
}
