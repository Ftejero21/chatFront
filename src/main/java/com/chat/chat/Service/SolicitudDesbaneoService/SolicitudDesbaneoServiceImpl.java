package com.chat.chat.Service.SolicitudDesbaneoService;

import com.chat.chat.DTO.SolicitudDesbaneoCreateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoCreateResponseDTO;
import com.chat.chat.DTO.SolicitudDesbaneoDTO;
import com.chat.chat.DTO.SolicitudDesbaneoEstadoUpdateDTO;
import com.chat.chat.DTO.SolicitudDesbaneoStatsDTO;
import com.chat.chat.DTO.SolicitudDesbaneoWsDTO;
import com.chat.chat.Entity.SolicitudDesbaneoEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.ConflictoException;
import com.chat.chat.Exceptions.RecursoNoEncontradoException;
import com.chat.chat.Mapper.SolicitudDesbaneoMapper;
import com.chat.chat.Repository.SolicitudDesbaneoRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.EmailService.EmailService;
import com.chat.chat.Service.UsuarioService.UsuarioService;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.SecurityUtils;
import com.chat.chat.Utils.SolicitudDesbaneoEstado;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class SolicitudDesbaneoServiceImpl implements SolicitudDesbaneoService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SolicitudDesbaneoServiceImpl.class);
    private static final int MAX_REASON_LENGTH = 1000;
    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final String EVENT_CREATED = "UNBAN_APPEAL_CREATED";
    private static final String EVENT_UPDATED = "UNBAN_APPEAL_UPDATED";

    private final SolicitudDesbaneoRepository solicitudDesbaneoRepository;
    private final UsuarioRepository usuarioRepository;
    private final UsuarioService usuarioService;
    private final EmailService emailService;
    private final SecurityUtils securityUtils;
    private final SimpMessagingTemplate messagingTemplate;
    private final SolicitudDesbaneoMapper solicitudDesbaneoMapper;

    public SolicitudDesbaneoServiceImpl(SolicitudDesbaneoRepository solicitudDesbaneoRepository,
                                        UsuarioRepository usuarioRepository,
                                        UsuarioService usuarioService,
                                        EmailService emailService,
                                        SecurityUtils securityUtils,
                                        SimpMessagingTemplate messagingTemplate,
                                        SolicitudDesbaneoMapper solicitudDesbaneoMapper) {
        this.solicitudDesbaneoRepository = solicitudDesbaneoRepository;
        this.usuarioRepository = usuarioRepository;
        this.usuarioService = usuarioService;
        this.emailService = emailService;
        this.securityUtils = securityUtils;
        this.messagingTemplate = messagingTemplate;
        this.solicitudDesbaneoMapper = solicitudDesbaneoMapper;
    }

    @Override
    @Transactional
    public SolicitudDesbaneoCreateResponseDTO crearSolicitud(SolicitudDesbaneoCreateDTO request) {
        if (request == null) {
            throw new IllegalArgumentException("Payload de solicitud de desbaneo vacio");
        }

        String email = normalizeAndValidateEmail(request.getEmail());
        String motivo = normalizeOptionalReason(request.getMotivo(), "motivo");

        UsuarioEntity usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_SOLICITUD_DESBANEO_EMAIL_NO_EXISTE));

        if (usuario.isActivo()) {
            throw new ConflictoException(Constantes.MSG_SOLICITUD_DESBANEO_USUARIO_NO_BANEADO);
        }

        boolean alreadyOpen = solicitudDesbaneoRepository.existsByEmailAndEstadoIn(
                email,
                List.of(SolicitudDesbaneoEstado.PENDIENTE, SolicitudDesbaneoEstado.EN_REVISION));
        if (alreadyOpen) {
            throw new ConflictoException(Constantes.MSG_SOLICITUD_DESBANEO_YA_ABIERTA);
        }

        SolicitudDesbaneoEntity entity = new SolicitudDesbaneoEntity();
        entity.setUsuarioId(usuario.getId());
        entity.setEmail(email);
        entity.setMotivo(motivo);
        entity.setEstado(SolicitudDesbaneoEstado.PENDIENTE);

        SolicitudDesbaneoEntity saved = solicitudDesbaneoRepository.save(entity);

        LOGGER.info(Constantes.LOG_UNBAN_APPEAL_CREATED,
                saved.getId(),
                saved.getUsuarioId(),
                saved.getEmail(),
                saved.getEstado());

        publishWsEvent(EVENT_CREATED, saved);
        return new SolicitudDesbaneoCreateResponseDTO(Constantes.MSG_SOLICITUD_DESBANEO_CREADA, saved.getId());
    }

    @Override
    public Page<SolicitudDesbaneoDTO> listarSolicitudes(String estado, String estados, Integer page, Integer size, String sort) {
        int safePage = page == null ? DEFAULT_PAGE : Math.max(DEFAULT_PAGE, page);
        int requestedSize = size == null ? DEFAULT_SIZE : size;
        int safeSize = Math.max(1, Math.min(MAX_SIZE, requestedSize));

        Pageable pageable = PageRequest.of(safePage, safeSize, resolveSort(sort));
        List<SolicitudDesbaneoEstado> estadoFilters = parseEstadosFilter(estado, estados);
        Page<SolicitudDesbaneoEntity> resultPage = (estadoFilters == null || estadoFilters.isEmpty())
                ? solicitudDesbaneoRepository.findAll(pageable)
                : solicitudDesbaneoRepository.findAllByEstadoIn(estadoFilters, pageable);
        Map<Long, UsuarioEntity> usuariosById = loadUsuariosById(resultPage.getContent());
        List<SolicitudDesbaneoDTO> content = resultPage.getContent().stream()
                .map(entity -> solicitudDesbaneoMapper.toDto(
                        entity,
                        entity.getUsuarioId() == null ? null : usuariosById.get(entity.getUsuarioId())))
                .collect(Collectors.toList());
        return new PageImpl<>(content, pageable, resultPage.getTotalElements());
    }

    @Override
    public SolicitudDesbaneoDTO obtenerSolicitud(Long id) {
        SolicitudDesbaneoEntity entity = solicitudDesbaneoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_SOLICITUD_DESBANEO_NO_ENCONTRADA));
        Map<Long, UsuarioEntity> usuariosById = loadUsuariosById(List.of(entity));
        return solicitudDesbaneoMapper.toDto(entity, usuariosById.get(entity.getUsuarioId()));
    }

    @Override
    @Transactional
    public SolicitudDesbaneoDTO actualizarEstado(Long id, SolicitudDesbaneoEstadoUpdateDTO request) {
        if (request == null || request.getEstado() == null || request.getEstado().isBlank()) {
            throw new IllegalArgumentException("estado es obligatorio");
        }

        SolicitudDesbaneoEntity entity = solicitudDesbaneoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(Constantes.MSG_SOLICITUD_DESBANEO_NO_ENCONTRADA));
        SolicitudDesbaneoEstado newEstado = parseEstadoRequired(request.getEstado());
        String resolucionMotivo = resolveResolutionReason(newEstado, request.getResolucionMotivo());
        SolicitudDesbaneoEstado oldEstado = entity.getEstado();
        Long reviewedByAdminId = securityUtils.getAuthenticatedUserId();

        entity.setEstado(newEstado);
        entity.setReviewedByAdminId(reviewedByAdminId);
        entity.setResolucionMotivo(resolucionMotivo);

        UsuarioEntity usuario = resolveUsuario(entity);
        boolean alreadyApproved = oldEstado == SolicitudDesbaneoEstado.APROBADA;
        boolean userAlreadyActive = usuario != null && usuario.isActivo();

        if (newEstado == SolicitudDesbaneoEstado.APROBADA) {
            // Reutiliza exactamente la lógica administrativa existente para desbanear.
            if (!alreadyApproved && !userAlreadyActive) {
                usuarioService.desbanearAdministrativamente(usuario.getId(), resolucionMotivo);
            }
        } else if (newEstado == SolicitudDesbaneoEstado.RECHAZADA) {
            boolean alreadyRejected = oldEstado == SolicitudDesbaneoEstado.RECHAZADA;
            if (!alreadyRejected) {
                sendRejectionEmail(usuario, entity.getEmail(), resolucionMotivo);
            }
        }

        SolicitudDesbaneoEntity saved = solicitudDesbaneoRepository.save(entity);
        LOGGER.info(Constantes.LOG_UNBAN_APPEAL_STATUS_UPDATED,
                saved.getId(),
                oldEstado,
                saved.getEstado(),
                reviewedByAdminId,
                LocalDateTime.now());

        publishWsEvent(EVENT_UPDATED, saved);
        Map<Long, UsuarioEntity> usuariosById = loadUsuariosById(List.of(saved));
        return solicitudDesbaneoMapper.toDto(saved, usuariosById.get(saved.getUsuarioId()));
    }

    @Override
    public SolicitudDesbaneoStatsDTO obtenerStats() {
        return obtenerStats(null);
    }

    @Override
    public SolicitudDesbaneoStatsDTO obtenerStats(String tz) {
        long pendientes = solicitudDesbaneoRepository.countByEstado(SolicitudDesbaneoEstado.PENDIENTE);
        long enRevision = solicitudDesbaneoRepository.countByEstado(SolicitudDesbaneoEstado.EN_REVISION);
        long aprobadas = solicitudDesbaneoRepository.countByEstado(SolicitudDesbaneoEstado.APROBADA);
        long rechazadas = solicitudDesbaneoRepository.countByEstado(SolicitudDesbaneoEstado.RECHAZADA);
        ZoneId queryZone = resolveZoneId(tz);
        ZoneId serverZone = ZoneId.systemDefault();
        ZonedDateTime nowInQueryZone = ZonedDateTime.now(queryZone);
        ZonedDateTime startOfDayInQueryZone = nowInQueryZone.toLocalDate().atStartOfDay(queryZone);
        ZonedDateTime endOfDayInQueryZone = startOfDayInQueryZone.plusDays(1);

        LocalDateTime from = startOfDayInQueryZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime to = endOfDayInQueryZone.withZoneSameInstant(serverZone).toLocalDateTime();
        List<SolicitudDesbaneoEntity> todayRows = solicitudDesbaneoRepository
                .findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to);

        Set<String> uniqueReporters = new HashSet<>();
        for (SolicitudDesbaneoEntity row : todayRows) {
            if (row == null) {
                continue;
            }
            if (row.getUsuarioId() != null) {
                uniqueReporters.add("u:" + row.getUsuarioId());
                continue;
            }
            String normalizedEmail = normalizeEmailNullable(row.getEmail());
            if (normalizedEmail != null) {
                uniqueReporters.add("e:" + normalizedEmail);
            }
        }

        SolicitudDesbaneoStatsDTO stats = new SolicitudDesbaneoStatsDTO();
        stats.setPendientes(pendientes);
        stats.setEnRevision(enRevision);
        stats.setAprobadas(aprobadas);
        stats.setRechazadas(rechazadas);
        stats.setAbiertas(pendientes + enRevision);
        stats.setHoyReportantesUnicos(uniqueReporters.size());
        stats.setFechaReferencia(nowInQueryZone.toLocalDate().toString());
        stats.setTimezone(queryZone.getId());
        return stats;
    }

    private void publishWsEvent(String eventName, SolicitudDesbaneoEntity entity) {
        UsuarioEntity usuario = entity.getUsuarioId() == null
                ? null
                : usuarioRepository.findById(entity.getUsuarioId()).orElse(null);
        SolicitudDesbaneoWsDTO payload = solicitudDesbaneoMapper.toWsDto(eventName, entity, usuario);
        messagingTemplate.convertAndSend(Constantes.TOPIC_ADMIN_SOLICITUDES_DESBANEO, payload);
    }

    private Map<Long, UsuarioEntity> loadUsuariosById(List<SolicitudDesbaneoEntity> solicitudes) {
        if (solicitudes == null || solicitudes.isEmpty()) {
            return Map.of();
        }
        Set<Long> ids = solicitudes.stream()
                .map(SolicitudDesbaneoEntity::getUsuarioId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, UsuarioEntity> out = new HashMap<>();
        usuarioRepository.findAllById(ids).forEach(usuario -> out.put(usuario.getId(), usuario));
        return out;
    }

    private String resolveResolutionReason(SolicitudDesbaneoEstado estado, String providedReason) {
        String normalized = normalizeOptionalReason(providedReason, "resolucionMotivo");
        if (normalized != null) {
            return normalized;
        }
        if (estado == SolicitudDesbaneoEstado.APROBADA) {
            return Constantes.MSG_SOLICITUD_DESBANEO_APROBADA_DEFAULT;
        }
        if (estado == SolicitudDesbaneoEstado.RECHAZADA) {
            return Constantes.MSG_SOLICITUD_DESBANEO_RECHAZADA_DEFAULT;
        }
        return null;
    }

    private UsuarioEntity resolveUsuario(SolicitudDesbaneoEntity entity) {
        if (entity == null) {
            throw new RecursoNoEncontradoException(Constantes.MSG_SOLICITUD_DESBANEO_NO_ENCONTRADA);
        }
        UsuarioEntity usuario = null;
        if (entity.getUsuarioId() != null) {
            usuario = usuarioRepository.findById(entity.getUsuarioId()).orElse(null);
        }
        if (usuario == null && entity.getEmail() != null && !entity.getEmail().isBlank()) {
            usuario = usuarioRepository.findByEmail(entity.getEmail()).orElse(null);
        }
        if (usuario == null) {
            throw new RecursoNoEncontradoException(Constantes.MSG_USUARIO_NO_ENCONTRADO);
        }
        return usuario;
    }

    private void sendRejectionEmail(UsuarioEntity usuario, String emailFallback, String resolucionMotivo) {
        if (usuario == null && (emailFallback == null || emailFallback.isBlank())) {
            return;
        }
        String email = usuario != null && usuario.getEmail() != null && !usuario.getEmail().isBlank()
                ? usuario.getEmail()
                : emailFallback;
        String nombre = usuario != null && usuario.getNombre() != null && !usuario.getNombre().isBlank()
                ? usuario.getNombre()
                : "Usuario";
        Map<String, String> vars = new HashMap<>();
        vars.put(Constantes.EMAIL_VAR_NOMBRE, nombre);
        vars.put(Constantes.EMAIL_VAR_MOTIVO, resolucionMotivo == null ? Constantes.MSG_SOLICITUD_DESBANEO_RECHAZADA_DEFAULT : resolucionMotivo);

        emailService.sendHtmlEmail(
                email,
                Constantes.EMAIL_SUBJECT_UNBAN_REJECTED,
                Constantes.EMAIL_TEMPLATE_UNBAN_REJECTED,
                vars
        );
    }

    private Sort resolveSort(String sortRaw) {
        if (sortRaw == null || sortRaw.isBlank()) {
            return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        }
        String[] parts = sortRaw.trim().split(",", 2);
        String field = parts[0].trim();
        if (field.isBlank()) {
            field = "createdAt";
        }

        Set<String> allowed = Set.of("createdAt", "updatedAt", "estado", "email", "id", "usuarioId");
        if (!allowed.contains(field)) {
            field = "createdAt";
        }

        String dirRaw = parts.length > 1 ? parts[1].trim().toLowerCase(Locale.ROOT) : "desc";
        Sort.Direction direction = "asc".equals(dirRaw) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(new Sort.Order(direction, field));
        if (!"id".equals(field)) {
            sort = sort.and(Sort.by(Sort.Order.desc("id")));
        }
        return sort;
    }

    private String normalizeAndValidateEmail(String emailRaw) {
        if (emailRaw == null || emailRaw.isBlank()) {
            throw new IllegalArgumentException("email es obligatorio");
        }
        String normalized = emailRaw.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 190 || !EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("email invalido");
        }
        return normalized;
    }

    private String normalizeEmailNullable(String emailRaw) {
        if (emailRaw == null) {
            return null;
        }
        String normalized = emailRaw.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private ZoneId resolveZoneId(String tz) {
        if (tz == null || tz.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(tz.trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException("tz invalida: " + tz);
        }
    }

    private String normalizeOptionalReason(String reasonRaw, String fieldName) {
        if (reasonRaw == null) {
            return null;
        }
        String normalized = reasonRaw.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > MAX_REASON_LENGTH) {
            throw new IllegalArgumentException(fieldName + " supera el maximo de " + MAX_REASON_LENGTH + " caracteres");
        }
        return normalized;
    }

    private List<SolicitudDesbaneoEstado> parseEstadosFilter(String estadoLegacy, String estadosCsv) {
        String source = (estadosCsv != null && !estadosCsv.isBlank()) ? estadosCsv : estadoLegacy;
        if (source == null || source.isBlank()) {
            return List.of();
        }

        LinkedHashSet<SolicitudDesbaneoEstado> parsed = new LinkedHashSet<>();
        String[] tokens = source.split(",");
        for (String token : tokens) {
            if (token == null || token.isBlank()) {
                continue;
            }
            parsed.add(parseEstadoRequired(token));
        }
        return new ArrayList<>(parsed);
    }

    private SolicitudDesbaneoEstado parseEstadoRequired(String raw) {
        try {
            return SolicitudDesbaneoEstado.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("estado invalido. Valores permitidos: PENDIENTE, EN_REVISION, APROBADA, RECHAZADA");
        }
    }
}
