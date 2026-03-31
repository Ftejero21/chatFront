package com.chat.chat.Service.MensajeProgramadoService;

import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.MensajeProgramadoDTO;
import com.chat.chat.DTO.ProgramarMensajeItemDTO;
import com.chat.chat.DTO.ProgramarMensajeRequestDTO;
import com.chat.chat.DTO.ProgramarMensajeResponseDTO;
import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.MensajeProgramadoEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.E2EGroupValidationException;
import com.chat.chat.Exceptions.RecursoNoEncontradoException;
import com.chat.chat.Exceptions.ValidacionPayloadException;
import com.chat.chat.Mapper.MensajeProgramadoMapper;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.MensajeProgramadoRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.E2EDiagnosticUtils;
import com.chat.chat.Utils.E2EPayloadUtils;
import com.chat.chat.Utils.EstadoMensajeProgramado;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.MessageType;
import com.chat.chat.Utils.SecurityUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MensajeProgramadoServiceImpl implements MensajeProgramadoService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MensajeProgramadoServiceImpl.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String MODE_PASSTHROUGH_E2E = "PASSTHROUGH_E2E";
    private static final String MODE_LEGACY_ENCRYPT = "LEGACY_ENCRYPT";
    private static final String TYPE_E2E = "E2E";
    private static final String TYPE_E2E_GROUP = "E2E_GROUP";
    private static final String TYPE_E2E_FILE = "E2E_FILE";
    private static final String TYPE_E2E_GROUP_FILE = "E2E_GROUP_FILE";

    private final SecurityUtils securityUtils;
    private final UsuarioRepository usuarioRepository;
    private final ChatIndividualRepository chatIndividualRepository;
    private final ChatGrupalRepository chatGrupalRepository;
    private final MensajeProgramadoRepository mensajeProgramadoRepository;
    private final MensajeRepository mensajeRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final JdbcTemplate jdbcTemplate;
    private final CifradorE2EMensajeProgramadoService cifradorE2EMensajeProgramadoService;
    private final MensajeProgramadoMapper mensajeProgramadoMapper;

    @Value("${app.chat.scheduled.max-attempts:3}")
    private int maxAttempts;

    @Value("${app.uploads.security.max-file-bytes:26214400}")
    private long maxUploadFileBytes;

    public MensajeProgramadoServiceImpl(SecurityUtils securityUtils,
                                        UsuarioRepository usuarioRepository,
                                        ChatIndividualRepository chatIndividualRepository,
                                        ChatGrupalRepository chatGrupalRepository,
                                        MensajeProgramadoRepository mensajeProgramadoRepository,
                                        MensajeRepository mensajeRepository,
                                        SimpMessagingTemplate messagingTemplate,
                                        JdbcTemplate jdbcTemplate,
                                        CifradorE2EMensajeProgramadoService cifradorE2EMensajeProgramadoService,
                                        MensajeProgramadoMapper mensajeProgramadoMapper) {
        this.securityUtils = securityUtils;
        this.usuarioRepository = usuarioRepository;
        this.chatIndividualRepository = chatIndividualRepository;
        this.chatGrupalRepository = chatGrupalRepository;
        this.mensajeProgramadoRepository = mensajeProgramadoRepository;
        this.mensajeRepository = mensajeRepository;
        this.messagingTemplate = messagingTemplate;
        this.jdbcTemplate = jdbcTemplate;
        this.cifradorE2EMensajeProgramadoService = cifradorE2EMensajeProgramadoService;
        this.mensajeProgramadoMapper = mensajeProgramadoMapper;
    }

    @Override
    @Transactional
    public ProgramarMensajeResponseDTO crearMensajesProgramados(ProgramarMensajeRequestDTO request) {
        List<String> detalleCampos = new ArrayList<>();
        if (request == null) {
            throw new ValidacionPayloadException("payload requerido", List.of("body"));
        }
        Long authUserId = securityUtils.getAuthenticatedUserId();
        if (request.getCreatedBy() != null && !Objects.equals(request.getCreatedBy(), authUserId)) {
            throw new AccessDeniedException("createdBy no coincide con el usuario autenticado");
        }
        String contenidoRaw = request.getContenido();
        boolean hasContenidoE2E = contenidoRaw != null && !contenidoRaw.trim().isBlank();
        ValidatedE2EPayload validatedE2EPayload = null;
        String message = request.getMessage() == null ? null : request.getMessage().trim();
        String tipoProgramado = Constantes.TIPO_TEXT;
        if (hasContenidoE2E) {
            validatedE2EPayload = validarPayloadE2EProgramadoOrThrow(
                    contenidoRaw,
                    authUserId,
                    request.getChatIds(),
                    request.getScheduledAt());
            if (validatedE2EPayload != null && isFilePayloadType(validatedE2EPayload.type())) {
                tipoProgramado = Constantes.TIPO_FILE;
            }
        } else if (message == null || message.isBlank()) {
            detalleCampos.add("message/contenido");
        }
        if (request.getScheduledAt() == null) {
            detalleCampos.add("scheduledAt/fechaProgramada");
        }
        Instant now = Instant.now();
        if (request.getScheduledAt() != null && !request.getScheduledAt().isAfter(now)) {
            detalleCampos.add("scheduledAt debe ser futuro UTC");
        }
        if (request.getChatIds() == null || request.getChatIds().isEmpty()) {
            detalleCampos.add("chatIds/chatId");
        }
        if (!detalleCampos.isEmpty()) {
            throw new ValidacionPayloadException("Payload invalido para programar mensaje", detalleCampos);
        }

        UsuarioEntity creador = usuarioRepository.findById(authUserId)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_ENCONTRADO));

        Set<Long> chatIdsUnicos = request.getChatIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (chatIdsUnicos.isEmpty()) {
            throw new IllegalArgumentException("chatIds no contiene ids validos");
        }

        String batchId = UUID.randomUUID().toString();
        List<MensajeProgramadoEntity> aGuardar = new ArrayList<>();
        List<ProgramarMensajeItemDTO> items = new ArrayList<>();
        for (Long chatId : chatIdsUnicos) {
            ChatEntity chat = validarPermisoSobreChat(chatId, authUserId);
            if (validatedE2EPayload != null) {
                validarCompatibilidadTipoE2EConChat(
                        validatedE2EPayload.type(),
                        chat,
                        authUserId,
                        chatIdsUnicos,
                        request.getScheduledAt());
            }
            MensajeProgramadoEntity entity = new MensajeProgramadoEntity();
            entity.setCreatedBy(creador);
            entity.setChat(chat);
            entity.setMessageContent(hasContenidoE2E ? contenidoRaw : message);
            entity.setScheduledAt(request.getScheduledAt());
            entity.setStatus(EstadoMensajeProgramado.PENDING);
            entity.setAttempts(0);
            entity.setLastError(null);
            entity.setScheduledBatchId(batchId);
            entity.setWsEmitted(false);
            entity.setWsEmittedAt(null);
            entity.setWsDestinations(null);
            entity.setWsEmitError(null);
            entity.setPersistedMessageId(null);
            aGuardar.add(entity);
        }

        List<MensajeProgramadoEntity> guardados = mensajeProgramadoRepository.saveAll(aGuardar);
        LOGGER.info("[SCHEDULED_MESSAGE_CREATE] userId={} chatIds={} scheduledAtUTC={} cantidadItemsCreados={} batchId={} hasContenidoE2E={} tipo={}",
                authUserId,
                chatIdsUnicos,
                request.getScheduledAt(),
                guardados.size(),
                batchId,
                hasContenidoE2E,
                tipoProgramado);
        for (MensajeProgramadoEntity guardado : guardados) {
            items.add(mensajeProgramadoMapper.toProgramarMensajeItemDto(guardado));
        }

        ProgramarMensajeResponseDTO out = new ProgramarMensajeResponseDTO();
        out.setOk(true);
        out.setScheduledBatchId(batchId);
        out.setItems(items);
        return out;
    }

    @Override
    public List<MensajeProgramadoDTO> listarMensajesProgramados(EstadoMensajeProgramado status) {
        Long authUserId = securityUtils.getAuthenticatedUserId();
        List<MensajeProgramadoEntity> rows = status == null
                ? mensajeProgramadoRepository.findByCreatedByIdOrderByCreatedAtDesc(authUserId)
                : mensajeProgramadoRepository.findByCreatedByIdAndStatusOrderByCreatedAtDesc(authUserId, status);
        return rows.stream().map(mensajeProgramadoMapper::toDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MensajeProgramadoDTO cancelarMensajeProgramado(Long id) {
        Long authUserId = securityUtils.getAuthenticatedUserId();
        boolean esAdmin = securityUtils.hasRole(Constantes.ADMIN) || securityUtils.hasRole(Constantes.ROLE_ADMIN);

        MensajeProgramadoEntity row = mensajeProgramadoRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mensaje programado no encontrado: " + id));

        Long ownerId = row.getCreatedBy() == null ? null : row.getCreatedBy().getId();
        if (!esAdmin && !Objects.equals(ownerId, authUserId)) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }
        if (row.getStatus() != EstadoMensajeProgramado.PENDING) {
            throw new IllegalArgumentException("Solo se puede cancelar en estado PENDING");
        }

        row.setStatus(EstadoMensajeProgramado.CANCELED);
        row.setLockToken(null);
        row.setLockUntil(null);
        row.setLastError(null);
        return mensajeProgramadoMapper.toDto(mensajeProgramadoRepository.save(row));
    }

    @Override
    @Transactional
    public List<Long> reclamarMensajesVencidos(Instant ahora, String lockToken, int limite, int lockSeconds) {
        int batchSize = Math.max(1, limite);
        Instant now = ahora == null ? Instant.now() : ahora;
        if (lockToken == null || lockToken.isBlank()) {
            return List.of();
        }

        Instant lockUntil = now.plusSeconds(Math.max(10, lockSeconds));
        int updated = jdbcTemplate.update(
                "UPDATE chat_scheduled_message " +
                        "SET status = 'PROCESSING', lock_token = ?, lock_until = ?, updated_at = ? " +
                        "WHERE (status = 'PENDING' OR (status = 'PROCESSING' AND lock_until IS NOT NULL AND lock_until < ?)) " +
                        "AND scheduled_at <= ? " +
                        "AND (lock_until IS NULL OR lock_until < ?) " +
                        "ORDER BY scheduled_at ASC, id ASC " +
                        "LIMIT ?",
                lockToken,
                lockUntil,
                now,
                now,
                now,
                now,
                batchSize);

        if (updated <= 0) {
            return List.of();
        }
        return jdbcTemplate.queryForList(
                "SELECT id FROM chat_scheduled_message " +
                        "WHERE status = 'PROCESSING' AND lock_token = ? " +
                        "ORDER BY scheduled_at ASC, id ASC",
                Long.class,
                lockToken);
    }

    @Override
    @Transactional
    public void procesarMensajeProgramado(Long id, String lockToken) {
        MensajeProgramadoEntity row = mensajeProgramadoRepository.findByIdForUpdate(id).orElse(null);
        if (row == null) {
            return;
        }
        EstadoMensajeProgramado estadoAnterior = row.getStatus();
        if (row.getStatus() == EstadoMensajeProgramado.SENT || row.getStatus() == EstadoMensajeProgramado.CANCELED) {
            return;
        }
        if (row.getStatus() != EstadoMensajeProgramado.PROCESSING || !Objects.equals(lockToken, row.getLockToken())) {
            return;
        }

        int intentoActual = (row.getAttempts() == null ? 0 : row.getAttempts()) + 1;
        row.setAttempts(intentoActual);

        try {
            PersistenciaProgramadaResultado resultado = prepararMensajeParaEnvio(row);
            MensajeDTO enviado = resultado.mensaje();
            row.setPersistedMessageId(enviado == null ? null : enviado.getId());
            row.setLastError(null);
            mensajeProgramadoRepository.save(row);
            programarEmisionWsAfterCommit(row, enviado, resultado.e2eType(), resultado.mode(), estadoAnterior, intentoActual);
        } catch (Exception ex) {
            boolean noRecuperable = esErrorNoRecuperable(ex);
            boolean agotado = intentoActual >= Math.max(1, maxAttempts);
            EstadoMensajeProgramado nuevoEstado = (noRecuperable || agotado)
                    ? EstadoMensajeProgramado.FAILED
                    : EstadoMensajeProgramado.PENDING;

            row.setStatus(nuevoEstado);
            row.setLastError(truncarError(ex.getMessage()));
            row.setLockToken(null);
            row.setLockUntil(null);
            row.setWsEmitted(false);
            row.setWsEmittedAt(null);
            row.setWsDestinations(null);
            row.setWsEmitError(truncarError(ex.getMessage()));
            mensajeProgramadoRepository.save(row);
            LOGGER.warn("[SCHEDULED_MESSAGE_ITEM] id={} chatId={} {}->{} attempts={} mode={} tipo={} error={}",
                    row.getId(),
                    row.getChat() == null ? null : row.getChat().getId(),
                    estadoAnterior,
                    row.getStatus(),
                    intentoActual,
                    resolverModoProcesamiento(row.getMessageContent()),
                    resolverTipoMensajeProgramado(row.getMessageContent()),
                    truncarError(ex.getMessage()));
            if (noRecuperable) {
                LOGGER.error("[SCHEDULED_MESSAGE_ITEM_NON_RECOVERABLE] id={} chatId={} errorType={} message={}",
                        row.getId(),
                        row.getChat() == null ? null : row.getChat().getId(),
                        ex.getClass().getSimpleName(),
                        ex.getMessage(),
                        ex);
            }
        }
    }

    private ChatEntity validarPermisoSobreChat(Long chatId, Long userId) {
        if (chatId == null) {
            throw new IllegalArgumentException("chatId es obligatorio");
        }
        if (userId == null) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }
        Optional<ChatIndividualEntity> chatIndividualOpt = chatIndividualRepository.findById(chatId);
        if (chatIndividualOpt.isPresent()) {
            ChatIndividualEntity ci = chatIndividualOpt.get();
            boolean miembro = (ci.getUsuario1() != null && Objects.equals(ci.getUsuario1().getId(), userId))
                    || (ci.getUsuario2() != null && Objects.equals(ci.getUsuario2().getId(), userId));
            if (!miembro) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_CHAT);
            }
            return ci;
        }

        Optional<ChatGrupalEntity> chatGrupalOpt = chatGrupalRepository.findByIdWithUsuarios(chatId);
        if (chatGrupalOpt.isPresent()) {
            ChatGrupalEntity cg = chatGrupalOpt.get();
            if (!cg.isActivo()) {
                throw new AccessDeniedException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
            }
            boolean miembroActivo = cg.getUsuarios() != null && cg.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), userId) && u.isActivo());
            if (!miembroActivo) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
            }
            return cg;
        }

        throw new RecursoNoEncontradoException(Constantes.MSG_CHAT_NO_ENCONTRADO_ID + chatId);
    }

    private PersistenciaProgramadaResultado prepararMensajeParaEnvio(MensajeProgramadoEntity row) {
        if (row.getPersistedMessageId() != null) {
            MensajeEntity persisted = mensajeRepository.findById(row.getPersistedMessageId())
                    .orElseThrow(() -> new RecursoNoEncontradoException(
                            "Mensaje ya persistido no encontrado: " + row.getPersistedMessageId()));
            MensajeDTO dto = MappingUtils.mensajeEntityADto(persisted);
            if (persisted.getEmisor() != null) {
                dto.setEmisorNombre(persisted.getEmisor().getNombre());
                dto.setEmisorApellido(persisted.getEmisor().getApellido());
                dto.setEmisorFoto(persisted.getEmisor().getFotoUrl());
            }
            return new PersistenciaProgramadaResultado(
                    dto,
                    resolverTipoE2E(dto.getContenido()),
                    resolverModoProcesamiento(row.getMessageContent()));
        }
        return persistirMensajeComoEnvioNormal(row);
    }

    private PersistenciaProgramadaResultado persistirMensajeComoEnvioNormal(MensajeProgramadoEntity row) {
        UsuarioEntity emisor = Optional.ofNullable(row.getCreatedBy())
                .map(UsuarioEntity::getId)
                .map(this::cargarUsuarioConClaveActual)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_ENCONTRADO));

        ChatEntity chat = row.getChat();
        if (chat == null || chat.getId() == null) {
            throw new RecursoNoEncontradoException(Constantes.MSG_CHAT_NO_ENCONTRADO_ID + null);
        }

        Long chatId = chat.getId();
        Optional<ChatIndividualEntity> chatIndividualOpt = chatIndividualRepository.findById(chatId);
        Optional<ChatGrupalEntity> chatGrupalOpt = chatIndividualOpt.isPresent()
                ? Optional.empty()
                : chatGrupalRepository.findByIdWithUsuarios(chatId);

        if (chatIndividualOpt.isEmpty() && chatGrupalOpt.isEmpty()) {
            throw new RecursoNoEncontradoException(Constantes.MSG_CHAT_NO_ENCONTRADO_ID + chatId);
        }

        MensajeEntity mensaje = new MensajeEntity();
        mensaje.setEmisor(emisor);
        mensaje.setChat(chatIndividualOpt.<ChatEntity>map(ci -> ci).orElseGet(chatGrupalOpt::get));
        mensaje.setTipo(MessageType.TEXT);
        CifradorE2EMensajeProgramadoService.ResultadoCifradoProgramado cifradoProgramado = null;
        ValidatedE2EPayload passthroughPayload = parsePayloadE2EProgramado(row.getMessageContent());
        String modoProcesamiento = passthroughPayload == null ? MODE_LEGACY_ENCRYPT : MODE_PASSTHROUGH_E2E;
        String payloadJsonFinal = null;
        String e2eTypeFinal = null;
        String rsaRuntimeFinal = "PASSTHROUGH";
        mensaje.setFechaEnvio(LocalDateTime.now());
        mensaje.setActivo(true);
        mensaje.setLeido(false);
        mensaje.setReenviado(false);
        mensaje.setMensajeTemporal(false);
        mensaje.setMensajeTemporalSegundos(null);
        mensaje.setExpiraEn(null);
        mensaje.setMotivoEliminacion(null);
        mensaje.setPlaceholderTexto(null);

        if (chatIndividualOpt.isPresent()) {
            ChatIndividualEntity ci = chatIndividualOpt.get();
            Long emisorId = emisor.getId();
            boolean emisorPertenece = (ci.getUsuario1() != null && Objects.equals(ci.getUsuario1().getId(), emisorId))
                    || (ci.getUsuario2() != null && Objects.equals(ci.getUsuario2().getId(), emisorId));
            if (!emisorPertenece) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_CHAT);
            }
            if (ci.getUsuario1() != null && Objects.equals(ci.getUsuario1().getId(), emisorId)) {
                Long receptorId = ci.getUsuario2() == null ? null : ci.getUsuario2().getId();
                mensaje.setReceptor(receptorId == null ? null : cargarUsuarioConClaveActual(receptorId));
            } else {
                Long receptorId = ci.getUsuario1() == null ? null : ci.getUsuario1().getId();
                mensaje.setReceptor(receptorId == null ? null : cargarUsuarioConClaveActual(receptorId));
            }
            if (mensaje.getReceptor() == null || mensaje.getReceptor().getId() == null) {
                throw new RecursoNoEncontradoException(Constantes.MSG_CHAT_INDIVIDUAL_NO_ENCONTRADO);
            }
            if (emisor.getBloqueados().contains(mensaje.getReceptor())
                    || mensaje.getReceptor().getBloqueados().contains(emisor)) {
                throw new AccessDeniedException(Constantes.MSG_NO_PUEDE_ENVIAR_MENSAJES);
            }
            if (passthroughPayload != null) {
                if (!(TYPE_E2E.equals(passthroughPayload.type()) || TYPE_E2E_FILE.equals(passthroughPayload.type()))) {
                    throw new IllegalArgumentException("contenido E2E no compatible con chat individual");
                }
                payloadJsonFinal = row.getMessageContent();
                e2eTypeFinal = passthroughPayload.type();
                if (TYPE_E2E_FILE.equals(passthroughPayload.type())) {
                    mensaje.setTipo(MessageType.FILE);
                } else {
                    mensaje.setTipo(MessageType.TEXT);
                }
            } else {
                cifradoProgramado = cifradorE2EMensajeProgramadoService.cifrarTextoIndividual(
                        row.getMessageContent(),
                        emisor,
                        mensaje.getReceptor());
                payloadJsonFinal = E2EPayloadUtils.normalizeForStorage(cifradoProgramado.payloadJson());
                e2eTypeFinal = cifradoProgramado.e2eType();
                rsaRuntimeFinal = cifradoProgramado.rsaRuntimeAlgorithm();
                mensaje.setTipo(MessageType.TEXT);
            }
        } else {
            mensaje.setReceptor(null);
            ChatGrupalEntity chatGrupal = chatGrupalOpt
                    .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO_ID + chatId));
            if (!chatGrupal.isActivo()) {
                throw new AccessDeniedException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
            }
            boolean emisorEsMiembroActivo = chatGrupal.getUsuarios() != null && chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), emisor.getId()) && u.isActivo());
            if (!emisorEsMiembroActivo) {
                throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
            }
            List<UsuarioEntity> receptoresActivos = chatGrupal.getUsuarios() == null
                    ? List.of()
                    : chatGrupal.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .filter(UsuarioEntity::isActivo)
                    .filter(u -> !Objects.equals(u.getId(), emisor.getId()))
                    .map(UsuarioEntity::getId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .map(this::cargarUsuarioConClaveActual)
                    .collect(Collectors.toList());
            if (passthroughPayload != null) {
                if (!(TYPE_E2E_GROUP.equals(passthroughPayload.type()) || TYPE_E2E_GROUP_FILE.equals(passthroughPayload.type()))) {
                    throw new IllegalArgumentException("contenido E2E no compatible con chat grupal");
                }
                payloadJsonFinal = row.getMessageContent();
                e2eTypeFinal = passthroughPayload.type();
                if (TYPE_E2E_GROUP_FILE.equals(passthroughPayload.type())) {
                    mensaje.setTipo(MessageType.FILE);
                } else {
                    mensaje.setTipo(MessageType.TEXT);
                }
            } else {
                cifradoProgramado = cifradorE2EMensajeProgramadoService.cifrarTextoGrupal(
                        row.getMessageContent(),
                        emisor,
                        receptoresActivos);
                payloadJsonFinal = E2EPayloadUtils.normalizeForStorage(cifradoProgramado.payloadJson());
                e2eTypeFinal = cifradoProgramado.e2eType();
                rsaRuntimeFinal = cifradoProgramado.rsaRuntimeAlgorithm();
                mensaje.setTipo(MessageType.TEXT);
            }
            mensaje.setChat(chatGrupal);
        }

        mensaje.setContenido(payloadJsonFinal);

        MensajeEntity saved = mensajeRepository.save(mensaje);
        MensajeDTO out = MappingUtils.mensajeEntityADto(saved);
        if (emisor != null) {
            out.setEmisorNombre(emisor.getNombre());
            out.setEmisorApellido(emisor.getApellido());
            out.setEmisorFoto(emisor.getFotoUrl());
        }
        registrarDiagnosticoCifradoProgramado(
                row,
                saved,
                out,
                emisor,
                mensaje.getReceptor(),
                payloadJsonFinal,
                rsaRuntimeFinal);
        return new PersistenciaProgramadaResultado(out, e2eTypeFinal, modoProcesamiento);
    }

    private String resolverTipoE2E(String contenido) {
        String clasificacion = E2EDiagnosticUtils.analyze(contenido, Constantes.TIPO_TEXT).getClassification();
        if ("JSON_E2E_GROUP_FILE".equals(clasificacion)) {
            return TYPE_E2E_GROUP_FILE;
        }
        if ("JSON_E2E_FILE".equals(clasificacion)) {
            return TYPE_E2E_FILE;
        }
        if ("JSON_E2E_GROUP".equals(clasificacion)) {
            return TYPE_E2E_GROUP;
        }
        return TYPE_E2E;
    }

    private UsuarioEntity cargarUsuarioConClaveActual(Long userId) {
        return usuarioRepository.findFreshById(userId)
                .or(() -> usuarioRepository.findById(userId))
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
    }

    private void registrarDiagnosticoCifradoProgramado(MensajeProgramadoEntity scheduled,
                                                       MensajeEntity persisted,
                                                       MensajeDTO dtoEmitido,
                                                       UsuarioEntity emisor,
                                                       UsuarioEntity receptor,
                                                       String payloadJson,
                                                       String rsaRuntimeAlgorithm) {
        if (scheduled == null || persisted == null) {
            return;
        }
        try {
            JsonNode root = payloadJson == null ? null : OBJECT_MAPPER.readTree(payloadJson);
            String forEmisor = textField(root, "forEmisor");
            String forReceptor = textField(root, "forReceptor");
            String forAdmin = textField(root, "forAdmin");
            String iv = textField(root, "iv");
            String ciphertext = textField(root, "ciphertext");
            String payloadType = textField(root, "type");
            String contenidoPersistido = persisted.getContenido();
            String contenidoEmitido = dtoEmitido == null ? null : dtoEmitido.getContenido();

            LOGGER.info("[SCHEDULED_MESSAGE_E2E_DIAG] scheduledMessageId={} mensajeId={} chatId={} payloadType={} emisorId={} receptorId={} emisorKeyFp={} receptorKeyFp={} forEmisorHash={} forReceptorHash={} forAdminHash={} ivLenB64={} ivLenBytes={} ciphertextLenB64={} ciphertextLenBytes={} forEmisorLenB64={} forEmisorLenBytes={} forReceptorLenB64={} forReceptorLenBytes={} forAdminLenB64={} forAdminLenBytes={} rsaRuntime={} persistedContentHash={} emittedContentHash={} persistedEqualsEmitted={}",
                    scheduled.getId(),
                    persisted.getId(),
                    persisted.getChat() == null ? null : persisted.getChat().getId(),
                    payloadType,
                    emisor == null ? null : emisor.getId(),
                    receptor == null ? null : receptor.getId(),
                    E2EDiagnosticUtils.fingerprint12(emisor == null ? null : emisor.getPublicKey()),
                    E2EDiagnosticUtils.fingerprint12(receptor == null ? null : receptor.getPublicKey()),
                    E2EDiagnosticUtils.fingerprint12(forEmisor),
                    E2EDiagnosticUtils.fingerprint12(forReceptor),
                    E2EDiagnosticUtils.fingerprint12(forAdmin),
                    safeLen(iv),
                    base64DecodedLen(iv),
                    safeLen(ciphertext),
                    base64DecodedLen(ciphertext),
                    safeLen(forEmisor),
                    base64DecodedLen(forEmisor),
                    safeLen(forReceptor),
                    base64DecodedLen(forReceptor),
                    safeLen(forAdmin),
                    base64DecodedLen(forAdmin),
                    rsaRuntimeAlgorithm,
                    E2EDiagnosticUtils.fingerprint12(contenidoPersistido),
                    E2EDiagnosticUtils.fingerprint12(contenidoEmitido),
                    Objects.equals(contenidoPersistido, contenidoEmitido));
        } catch (Exception ex) {
            LOGGER.warn("[SCHEDULED_MESSAGE_E2E_DIAG_WARN] scheduledMessageId={} mensajeId={} errorType={}",
                    scheduled.getId(),
                    persisted.getId(),
                    ex.getClass().getSimpleName());
        }
    }

    private String textField(JsonNode root, String field) {
        if (root == null || field == null || field.isBlank()) {
            return null;
        }
        JsonNode node = root.get(field);
        if (node == null || node.isNull() || !node.isTextual()) {
            return null;
        }
        String value = node.asText();
        return value == null || value.isBlank() ? null : value;
    }

    private Integer safeLen(String value) {
        return value == null ? null : value.length();
    }

    private Integer base64DecodedLen(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(value).length;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private ValidatedE2EPayload validarPayloadE2EProgramadoOrThrow(String rawPayload,
                                                                   Long authUserId,
                                                                   List<Long> chatIds,
                                                                   Instant scheduledAt) {
        ValidatedE2EPayload parsed = parsePayloadE2EProgramado(rawPayload);
        if (parsed != null) {
            return parsed;
        }
        String code = looksLikeFilePayload(rawPayload)
                ? Constantes.ERR_E2E_FILE_PAYLOAD_INVALID
                : Constantes.ERR_E2E_PAYLOAD_INVALID;
        String detail = "contenido no cumple esquema E2E/E2E_GROUP/E2E_FILE/E2E_GROUP_FILE requerido";
        String traceId = E2EDiagnosticUtils.newTraceId();
        LOGGER.warn("[SCHEDULED_MESSAGE_CREATE] userId={} chatIds={} scheduledAtUTC={} hasContenidoE2E=true error={} detail={}",
                authUserId,
                chatIds,
                scheduledAt,
                code,
                detail);
        LOGGER.warn("[VALIDATION_ERROR] code={} traceId={} tipo={} source=SCHEDULED_MESSAGE_CREATE",
                code,
                traceId,
                looksLikeFilePayload(rawPayload) ? Constantes.TIPO_FILE : Constantes.TIPO_TEXT);
        throw new E2EGroupValidationException(code, detail + " traceId=" + traceId);
    }

    private void validarCompatibilidadTipoE2EConChat(String payloadType,
                                                     ChatEntity chat,
                                                     Long authUserId,
                                                     Set<Long> chatIds,
                                                     Instant scheduledAt) {
        if (payloadType == null || chat == null) {
            return;
        }
        boolean compatible = (chat instanceof ChatIndividualEntity && (TYPE_E2E.equals(payloadType) || TYPE_E2E_FILE.equals(payloadType)))
                || (chat instanceof ChatGrupalEntity && (TYPE_E2E_GROUP.equals(payloadType) || TYPE_E2E_GROUP_FILE.equals(payloadType)));
        if (compatible) {
            return;
        }
        Long chatId = chat.getId();
        String tipoChat = chat instanceof ChatGrupalEntity ? "GRUPAL" : "INDIVIDUAL";
        String detail = "contenido type=" + payloadType + " no compatible con chatId=" + chatId + " tipoChat=" + tipoChat;
        String code = isFilePayloadType(payloadType)
                ? Constantes.ERR_E2E_FILE_PAYLOAD_INVALID
                : Constantes.ERR_E2E_PAYLOAD_INVALID;
        String traceId = E2EDiagnosticUtils.newTraceId();
        LOGGER.warn("[SCHEDULED_MESSAGE_CREATE] userId={} chatIds={} scheduledAtUTC={} hasContenidoE2E=true error={} detail={}",
                authUserId,
                chatIds,
                scheduledAt,
                code,
                detail);
        LOGGER.warn("[VALIDATION_ERROR] code={} traceId={} tipo={} source=SCHEDULED_CHAT_TYPE_COMPAT",
                code,
                traceId,
                isFilePayloadType(payloadType) ? Constantes.TIPO_FILE : Constantes.TIPO_TEXT);
        throw new E2EGroupValidationException(code, detail + " traceId=" + traceId);
    }

    private ValidatedE2EPayload parsePayloadE2EProgramado(String rawPayload) {
        if (rawPayload == null || rawPayload.trim().isEmpty()) {
            return null;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(rawPayload);
            String type = requiredTextField(root, "type");
            if (!TYPE_E2E.equals(type)
                    && !TYPE_E2E_GROUP.equals(type)
                    && !TYPE_E2E_FILE.equals(type)
                    && !TYPE_E2E_GROUP_FILE.equals(type)) {
                return null;
            }
            if (TYPE_E2E.equals(type) || TYPE_E2E_GROUP.equals(type)) {
                if (requiredTextField(root, "iv") == null
                        || requiredTextField(root, "ciphertext") == null
                        || requiredTextField(root, "forEmisor") == null
                        || requiredTextField(root, "forAdmin") == null) {
                    return null;
                }
            } else {
                if (requiredTextField(root, "ivFile") == null
                        || requiredTextField(root, "fileUrl") == null
                        || requiredTextField(root, "fileMime") == null
                        || requiredTextField(root, "fileNombre") == null
                        || requiredTextField(root, "forEmisor") == null
                        || requiredTextField(root, "forAdmin") == null) {
                    return null;
                }
                Long fileSizeBytes = requiredLongField(root, "fileSizeBytes");
                if (fileSizeBytes == null || fileSizeBytes <= 0L || fileSizeBytes > maxUploadFileBytes) {
                    return null;
                }
            }
            if (TYPE_E2E.equals(type) || TYPE_E2E_FILE.equals(type)) {
                if (requiredTextField(root, "forReceptor") == null) {
                    return null;
                }
            } else {
                JsonNode forReceptoresNode = root.get("forReceptores");
                if (forReceptoresNode == null || !forReceptoresNode.isObject() || !forReceptoresNode.fields().hasNext()) {
                    return null;
                }
            }
            return new ValidatedE2EPayload(type);
        } catch (Exception ex) {
            return null;
        }
    }

    private String requiredTextField(JsonNode root, String field) {
        if (root == null || field == null || field.isBlank()) {
            return null;
        }
        JsonNode node = root.get(field);
        if (node == null || node.isNull() || !node.isTextual()) {
            return null;
        }
        String value = node.asText();
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value;
    }

    private Long requiredLongField(JsonNode root, String field) {
        if (root == null || field == null || field.isBlank()) {
            return null;
        }
        JsonNode node = root.get(field);
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isIntegralNumber()) {
            return node.asLong();
        }
        if (node.isTextual()) {
            try {
                return Long.parseLong(node.asText().trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private String resolverModoProcesamiento(String messageContent) {
        return parsePayloadE2EProgramado(messageContent) == null
                ? MODE_LEGACY_ENCRYPT
                : MODE_PASSTHROUGH_E2E;
    }

    private boolean isFilePayloadType(String type) {
        return TYPE_E2E_FILE.equals(type) || TYPE_E2E_GROUP_FILE.equals(type);
    }

    private boolean looksLikeFilePayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return false;
        }
        return rawPayload.contains(TYPE_E2E_FILE) || rawPayload.contains(TYPE_E2E_GROUP_FILE);
    }

    private String resolverTipoMensajeProgramado(String messageContent) {
        ValidatedE2EPayload parsed = parsePayloadE2EProgramado(messageContent);
        if (parsed == null) {
            return Constantes.TIPO_TEXT;
        }
        return isFilePayloadType(parsed.type()) ? Constantes.TIPO_FILE : Constantes.TIPO_TEXT;
    }

    private boolean esErrorNoRecuperable(Exception ex) {
        if (ex instanceof ExcepcionCifradoProgramado excepcionCifradoProgramado) {
            return !excepcionCifradoProgramado.isRecuperable();
        }
        return ex instanceof AccessDeniedException
                || ex instanceof RecursoNoEncontradoException
                || ex instanceof IllegalArgumentException;
    }

    private String truncarError(String error) {
        if (error == null) {
            return null;
        }
        String normalized = error.trim();
        if (normalized.length() <= 1000) {
            return normalized;
        }
        return normalized.substring(0, 1000);
    }

    public String nowUtcIso() {
        return Instant.now().atOffset(ZoneOffset.UTC).toString();
    }

    private void programarEmisionWsAfterCommit(MensajeProgramadoEntity scheduled,
                                               MensajeDTO mensaje,
                                               String e2eType,
                                               String mode,
                                               EstadoMensajeProgramado estadoAnterior,
                                               int intentoActual) {
        Long scheduledId = scheduled == null ? null : scheduled.getId();
        Long chatId = (scheduled == null || scheduled.getChat() == null) ? null : scheduled.getChat().getId();
        Long senderId = mensaje == null ? null : mensaje.getEmisorId();
        Long mensajePersistidoId = mensaje == null ? null : mensaje.getId();

        Runnable emision = () -> {
            try {
                MensajeDTO mensajePersistidoParaEmitir = reconstruirMensajeDesdePersistencia(mensajePersistidoId, mensaje);
                WsEmissionResult result = emitirMensajeRealtime(chatId, mensajePersistidoParaEmitir);
                Instant nowUtc = Instant.now();
                actualizarResultadoFinal(
                        scheduledId,
                        EstadoMensajeProgramado.SENT,
                        nowUtc,
                        null,
                        true,
                        nowUtc,
                        result.destinationsCsv(),
                        null);
                LOGGER.info("[SCHEDULED_MESSAGE_WS_EMIT] scheduledMessageId={} chatId={} senderId={} tipoChat={} e2eType={} wsDestinations={} mensajeIdPersistido={} tsUTC={}",
                        scheduledId,
                        chatId,
                        mensajePersistidoParaEmitir == null ? senderId : mensajePersistidoParaEmitir.getEmisorId(),
                        result.chatType(),
                        e2eType,
                        result.destinationsCsv(),
                        mensajePersistidoId,
                        nowUtc);
                LOGGER.info("[SCHEDULED_MESSAGE_ITEM] id={} chatId={} {}->{} attempts={} mode={} tipo={} mensajeIdPersistido={} e2eType={} wsDestinations={} sentAtUTC={}",
                        scheduledId,
                        chatId,
                        estadoAnterior,
                        EstadoMensajeProgramado.SENT,
                        intentoActual,
                        mode,
                        mensajePersistidoParaEmitir == null ? null : mensajePersistidoParaEmitir.getTipo(),
                        mensajePersistidoId,
                        e2eType,
                        result.destinationsCsv(),
                        nowUtc);
            } catch (Exception ex) {
                Instant nowUtc = Instant.now();
                String err = truncarError(ex.getMessage());
                boolean agotado = intentoActual >= Math.max(1, maxAttempts);
                EstadoMensajeProgramado nuevoEstado = agotado
                        ? EstadoMensajeProgramado.FAILED
                        : EstadoMensajeProgramado.PENDING;
                actualizarResultadoFinal(
                        scheduledId,
                        nuevoEstado,
                        null,
                        err,
                        false,
                        null,
                        null,
                        err);
                LOGGER.warn("[SCHEDULED_MESSAGE_WS_EMIT_FAIL] scheduledMessageId={} chatId={} senderId={} mensajeIdPersistido={} mode={} e2eType={} nextStatus={} attempts={} error={} tsUTC={}",
                        scheduledId,
                        chatId,
                        senderId,
                        mensajePersistidoId,
                        mode,
                        e2eType,
                        nuevoEstado,
                        intentoActual,
                        err,
                        nowUtc);
                LOGGER.error("[SCHEDULED_MESSAGE_WS_EMIT_FAIL_STACK] scheduledMessageId={} chatId={} errorType={}",
                        scheduledId,
                        chatId,
                        ex.getClass().getSimpleName(),
                        ex);
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    emision.run();
                }
            });
            return;
        }
        emision.run();
    }

    private MensajeDTO reconstruirMensajeDesdePersistencia(Long mensajeId, MensajeDTO fallback) {
        if (mensajeId == null) {
            return fallback;
        }
        Optional<MensajeEntity> persistedOpt = mensajeRepository.findById(mensajeId);
        if (persistedOpt.isEmpty()) {
            return fallback;
        }
        MensajeEntity persisted = persistedOpt.get();
        MensajeDTO dto = MappingUtils.mensajeEntityADto(persisted);
        if (persisted.getEmisor() != null) {
            dto.setEmisorNombre(persisted.getEmisor().getNombre());
            dto.setEmisorApellido(persisted.getEmisor().getApellido());
            dto.setEmisorFoto(persisted.getEmisor().getFotoUrl());
        }
        return dto;
    }

    private WsEmissionResult emitirMensajeRealtime(Long chatId, MensajeDTO mensaje) {
        if (chatId == null || mensaje == null) {
            return new WsEmissionResult("UNKNOWN", List.of());
        }

        boolean esGrupal = chatGrupalRepository.findById(chatId).isPresent();
        if (esGrupal) {
            String destination = Constantes.TOPIC_CHAT_GRUPAL + chatId;
            messagingTemplate.convertAndSend(destination, mensaje);
            return new WsEmissionResult("GRUPAL", List.of(destination));
        }

        boolean esIndividual = chatIndividualRepository.findById(chatId).isPresent();
        if (esIndividual) {
            List<String> destinations = new ArrayList<>();
            if (mensaje.getEmisorId() != null) {
                String senderDest = Constantes.TOPIC_CHAT + mensaje.getEmisorId();
                messagingTemplate.convertAndSend(senderDest, mensaje);
                destinations.add(senderDest);
            }
            if (mensaje.getReceptorId() != null) {
                String receptorDest = Constantes.TOPIC_CHAT + mensaje.getReceptorId();
                messagingTemplate.convertAndSend(receptorDest, mensaje);
                destinations.add(receptorDest);
            }
            return new WsEmissionResult("INDIVIDUAL", destinations);
        }
        return new WsEmissionResult("UNKNOWN", List.of());
    }

    private void actualizarResultadoFinal(Long scheduledId,
                                          EstadoMensajeProgramado status,
                                          Instant sentAt,
                                          String lastError,
                                          boolean wsEmitted,
                                          Instant wsEmittedAt,
                                          String wsDestinations,
                                          String wsEmitError) {
        if (scheduledId == null) {
            return;
        }
        jdbcTemplate.update(
                "UPDATE chat_scheduled_message " +
                        "SET status = ?, sent_at = ?, last_error = ?, lock_token = NULL, lock_until = NULL, " +
                        "ws_emitted = ?, ws_emitted_at = ?, ws_destinations = ?, ws_emit_error = ?, updated_at = ? " +
                        "WHERE id = ?",
                status == null ? null : status.name(),
                sentAt,
                lastError,
                wsEmitted,
                wsEmittedAt,
                wsDestinations,
                wsEmitError,
                Instant.now(),
                scheduledId);
    }

    private record PersistenciaProgramadaResultado(MensajeDTO mensaje, String e2eType, String mode) {
    }

    private record ValidatedE2EPayload(String type) {
    }

    private record WsEmissionResult(String chatType, List<String> destinations) {
        String destinationsCsv() {
            if (destinations == null || destinations.isEmpty()) {
                return "";
            }
            return String.join(",", destinations);
        }
    }
}
