package com.chat.chat.Service.EncuestaService;

import com.chat.chat.DTO.EncuestaDTO;
import com.chat.chat.DTO.EncuestaOpcionDTO;
import com.chat.chat.DTO.EncuestaVotanteDTO;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.EncuestaEntity;
import com.chat.chat.Entity.EncuestaOpcionEntity;
import com.chat.chat.Entity.EncuestaVotoEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.RecursoNoEncontradoException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.EncuestaOpcionRepository;
import com.chat.chat.Repository.EncuestaRepository;
import com.chat.chat.Repository.EncuestaVotoRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.MessageType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class EncuestaServiceImpl implements EncuestaService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncuestaServiceImpl.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String POLL_V1 = "POLL_V1";
    private static final String CONTENT_KIND_POLL = "POLL";

    private final EncuestaRepository encuestaRepository;
    private final EncuestaOpcionRepository encuestaOpcionRepository;
    private final EncuestaVotoRepository encuestaVotoRepository;
    private final MensajeRepository mensajeRepository;
    private final UsuarioRepository usuarioRepository;
    private final ChatGrupalRepository chatGrupalRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public EncuestaServiceImpl(EncuestaRepository encuestaRepository,
                               EncuestaOpcionRepository encuestaOpcionRepository,
                               EncuestaVotoRepository encuestaVotoRepository,
                               MensajeRepository mensajeRepository,
                               UsuarioRepository usuarioRepository,
                               ChatGrupalRepository chatGrupalRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.encuestaRepository = encuestaRepository;
        this.encuestaOpcionRepository = encuestaOpcionRepository;
        this.encuestaVotoRepository = encuestaVotoRepository;
        this.mensajeRepository = mensajeRepository;
        this.usuarioRepository = usuarioRepository;
        this.chatGrupalRepository = chatGrupalRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public boolean esMensajeEncuesta(MensajeDTO dto) {
        if (dto == null) {
            return false;
        }
        return equalsIgnoreCaseSafe(dto.getTipo(), Constantes.TIPO_POLL)
                || equalsIgnoreCaseSafe(dto.getContentKind(), CONTENT_KIND_POLL)
                || equalsIgnoreCaseSafe(dto.getPollType(), POLL_V1)
                || dto.getPoll() != null;
    }

    @Override
    public void normalizarPayloadEncuesta(MensajeDTO dto) {
        if (!esMensajeEncuesta(dto)) {
            return;
        }
        dto.setTipo(Constantes.TIPO_POLL);
        dto.setContentKind(CONTENT_KIND_POLL);
        dto.setPollType(POLL_V1);
        if (dto.getPoll() != null && (dto.getPoll().getType() == null || dto.getPoll().getType().isBlank())) {
            dto.getPoll().setType(POLL_V1);
        }
    }

    @Override
    public void crearEncuestaParaMensaje(MensajeEntity mensaje, MensajeDTO dto, UsuarioEntity creador) {
        if (mensaje == null || mensaje.getId() == null || !esMensajeEncuesta(dto)) {
            return;
        }
        if (encuestaRepository.findByMensajeId(mensaje.getId()).isPresent()) {
            return;
        }
        EncuestaDTO entrada = resolveEncuestaEntrada(dto);
        String pregunta = normalizeText(entrada.getQuestion());
        if (pregunta == null) {
            throw new IllegalArgumentException("La encuesta requiere question");
        }
        List<EncuestaOpcionDTO> opcionesEntrada = entrada.getOptions() == null ? List.of() : entrada.getOptions();
        if (opcionesEntrada.size() < 2) {
            throw new IllegalArgumentException("La encuesta requiere al menos 2 opciones");
        }
        if (creador == null || creador.getId() == null) {
            throw new IllegalArgumentException("No se pudo resolver el creador de la encuesta");
        }

        EncuestaEntity encuesta = new EncuestaEntity();
        encuesta.setMensaje(mensaje);
        encuesta.setChat(mensaje.getChat());
        encuesta.setQuestion(pregunta);
        encuesta.setAllowMultiple(Boolean.TRUE.equals(entrada.getAllowMultiple()));
        encuesta.setCreatedBy(creador);
        encuesta.setCreatedAt(resolveCreatedAt(entrada, mensaje));
        encuesta.setActivo(true);
        EncuestaEntity savedEncuesta = encuestaRepository.save(encuesta);

        Set<String> keysUsadas = new LinkedHashSet<>();
        List<EncuestaOpcionEntity> opciones = new ArrayList<>();
        for (int i = 0; i < opcionesEntrada.size(); i++) {
            EncuestaOpcionDTO opcionEntrada = opcionesEntrada.get(i);
            String texto = opcionEntrada == null ? null : normalizeText(opcionEntrada.getText());
            if (texto == null) {
                throw new IllegalArgumentException("Todas las opciones de la encuesta requieren text");
            }
            String optionKey = normalizeOptionKey(opcionEntrada == null ? null : opcionEntrada.getId(), i, keysUsadas);

            EncuestaOpcionEntity opcion = new EncuestaOpcionEntity();
            opcion.setEncuesta(savedEncuesta);
            opcion.setOptionKey(optionKey);
            opcion.setOptionText(texto);
            opcion.setOrderIndex(i);
            opcion.setVoteCount(0L);
            opciones.add(opcion);
        }
        encuestaOpcionRepository.saveAll(opciones);
    }

    @Override
    public void enriquecerMensajesConEncuesta(List<MensajeEntity> mensajes,
                                              List<MensajeDTO> mensajesDto,
                                              Long usuarioId,
                                              boolean incluirIdsVotantes) {
        if (mensajes == null || mensajesDto == null || mensajes.isEmpty() || mensajesDto.isEmpty()) {
            return;
        }

        Map<Long, MensajeDTO> dtoPorMensajeId = new LinkedHashMap<>();
        for (int i = 0; i < Math.min(mensajes.size(), mensajesDto.size()); i++) {
            MensajeEntity mensaje = mensajes.get(i);
            MensajeDTO dto = mensajesDto.get(i);
            if (mensaje != null && mensaje.getId() != null && dto != null) {
                dtoPorMensajeId.put(mensaje.getId(), dto);
            }
        }
        if (dtoPorMensajeId.isEmpty()) {
            return;
        }

        List<Long> mensajeIds = new ArrayList<>(dtoPorMensajeId.keySet());
        List<EncuestaEntity> encuestas = encuestaRepository.findByMensajeIdIn(mensajeIds);
        if (encuestas.isEmpty()) {
            return;
        }

        Map<Long, EncuestaEntity> encuestaPorMensajeId = encuestas.stream()
                .filter(Objects::nonNull)
                .filter(e -> e.getMensaje() != null && e.getMensaje().getId() != null)
                .collect(Collectors.toMap(
                        e -> e.getMensaje().getId(),
                        e -> e,
                        (a, b) -> a,
                        LinkedHashMap::new));

        List<Long> encuestaIds = encuestas.stream()
                .map(EncuestaEntity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<EncuestaOpcionEntity> opciones = encuestaIds.isEmpty()
                ? List.of()
                : encuestaOpcionRepository.findByEncuestaIdInOrderByEncuestaIdAscOrderIndexAscIdAsc(encuestaIds);
        Map<Long, List<EncuestaOpcionEntity>> opcionesPorEncuesta = opciones.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(
                        opcion -> opcion.getEncuesta().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<EncuestaVotoEntity> votos = encuestaIds.isEmpty()
                ? List.of()
                : encuestaVotoRepository.findByEncuestaIdIn(encuestaIds);
        Map<Long, List<EncuestaVotoEntity>> votosPorEncuesta = votos.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(
                        voto -> voto.getEncuesta().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        for (Long mensajeId : mensajeIds) {
            MensajeDTO dto = dtoPorMensajeId.get(mensajeId);
            if (dto == null || "EXPIRADO".equalsIgnoreCase(dto.getEstadoTemporal())) {
                continue;
            }
            EncuestaEntity encuesta = encuestaPorMensajeId.get(mensajeId);
            if (encuesta == null) {
                continue;
            }
            List<EncuestaOpcionEntity> opcionesEncuesta = opcionesPorEncuesta.getOrDefault(encuesta.getId(), List.of());
            List<EncuestaVotoEntity> votosEncuesta = votosPorEncuesta.getOrDefault(encuesta.getId(), List.of());

            dto.setTipo(Constantes.TIPO_POLL);
            dto.setContentKind(CONTENT_KIND_POLL);
            dto.setPollType(POLL_V1);
            dto.setPoll(buildSnapshot(encuesta, opcionesEncuesta, votosEncuesta, usuarioId, incluirIdsVotantes));
        }
    }

    @Override
    @Transactional
    public MensajeDTO votarEncuesta(VotoEncuestaDTO solicitud, Long usuarioId) {
        if (solicitud == null) {
            throw new IllegalArgumentException("payload de voto de encuesta vacio");
        }
        if (solicitud.getMensajeId() == null) {
            throw new IllegalArgumentException("mensajeId es obligatorio");
        }
        if (solicitud.getOptionId() == null || solicitud.getOptionId().isBlank()) {
            throw new IllegalArgumentException("optionId es obligatorio");
        }
        if (solicitud.getUserId() != null && !Objects.equals(solicitud.getUserId(), usuarioId)) {
            throw new AccessDeniedException("userId no coincide con el usuario autenticado");
        }

        MensajeEntity mensaje = mensajeRepository.findById(solicitud.getMensajeId())
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el mensaje de encuesta: " + solicitud.getMensajeId()));
        if (solicitud.getChatId() != null && (mensaje.getChat() == null || !Objects.equals(mensaje.getChat().getId(), solicitud.getChatId()))) {
            throw new IllegalArgumentException("chatId no coincide con el mensaje");
        }
        if (mensaje.getExpiraEn() != null && !mensaje.getExpiraEn().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("No se puede votar una encuesta expirada");
        }
        if (mensaje.getChat() == null) {
            throw new RecursoNoEncontradoException("El mensaje no pertenece a un chat");
        }
        if (!(mensaje.getChat() instanceof ChatGrupalEntity)) {
            throw new AccessDeniedException("La votacion de encuestas solo aplica en chat grupal");
        }
        Long chatId = mensaje.getChat().getId();
        ChatGrupalEntity chat = chatGrupalRepository.findByIdWithUsuarios(chatId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Chat grupal no encontrado: " + chatId));
        if (!chat.isActivo()) {
            throw new AccessDeniedException(Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO);
        }
        boolean esMiembroActivo = chat.getUsuarios() != null && chat.getUsuarios().stream()
                .filter(Objects::nonNull)
                .anyMatch(u -> Objects.equals(u.getId(), usuarioId) && u.isActivo());
        if (!esMiembroActivo) {
            throw new AccessDeniedException(Constantes.MSG_NO_PERTENECE_GRUPO);
        }

        EncuestaEntity encuesta = encuestaRepository.findByMensajeIdForUpdate(mensaje.getId())
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe encuesta para mensajeId: " + mensaje.getId()));
        if (solicitud.getPollId() != null && !Objects.equals(solicitud.getPollId(), encuesta.getId())) {
            throw new IllegalArgumentException("pollId no coincide con el mensaje");
        }

        List<EncuestaOpcionEntity> opciones = encuestaOpcionRepository.findByEncuestaIdOrderByOrderIndexAscIdAsc(encuesta.getId());
        EncuestaOpcionEntity opcionElegida = resolveOpcion(encuesta.getId(), solicitud.getOptionId(), opciones);
        UsuarioEntity usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado: " + usuarioId));

        if (encuesta.isAllowMultiple()) {
            aplicarToggleMultiple(encuesta, opcionElegida, usuario);
        } else {
            aplicarToggleSingle(encuesta, opcionElegida, usuario);
        }

        recalculateAndPersistCounts(encuesta.getId(), opciones);
        List<EncuestaVotoEntity> votos = encuestaVotoRepository.findByEncuestaId(encuesta.getId());

        MensajeDTO actualizadoRest = buildMensajeEncuestaActualizado(mensaje);
        actualizadoRest.setPoll(buildSnapshot(encuesta, opciones, votos, usuarioId, true));

        // Broadcast grupal: voterIds completos y sin votedByMe por receptor (campo opcional).
        MensajeDTO actualizadoBroadcast = buildMensajeEncuestaActualizado(mensaje);
        actualizadoBroadcast.setPoll(buildSnapshot(encuesta, opciones, votos, null, true));
        messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_GRUPAL + chatId, actualizadoBroadcast);
        LOGGER.info("[ENCUESTA_VOTO] chatId={} mensajeId={} encuestaId={} opcion={} usuarioId={} ts={}",
                chatId,
                mensaje.getId(),
                encuesta.getId(),
                solicitud.getOptionId(),
                usuarioId,
                LocalDateTime.now());
        return actualizadoRest;
    }

    private void aplicarToggleSingle(EncuestaEntity encuesta, EncuestaOpcionEntity opcionElegida, UsuarioEntity usuario) {
        List<EncuestaVotoEntity> votosUsuario = encuestaVotoRepository.findByEncuestaIdAndUsuarioId(encuesta.getId(), usuario.getId());
        boolean mismaOpcion = votosUsuario.stream()
                .anyMatch(voto -> voto.getOpcion() != null && Objects.equals(voto.getOpcion().getId(), opcionElegida.getId()));
        if (mismaOpcion) {
            encuestaVotoRepository.deleteByEncuestaIdAndUsuarioIdAndOpcionId(encuesta.getId(), usuario.getId(), opcionElegida.getId());
            return;
        }
        if (!votosUsuario.isEmpty()) {
            encuestaVotoRepository.deleteByEncuestaIdAndUsuarioId(encuesta.getId(), usuario.getId());
        }
        persistVoteSafe(encuesta, opcionElegida, usuario);
    }

    private void aplicarToggleMultiple(EncuestaEntity encuesta, EncuestaOpcionEntity opcionElegida, UsuarioEntity usuario) {
        Optional<EncuestaVotoEntity> existente = encuestaVotoRepository.findByEncuestaIdAndUsuarioIdAndOpcionId(
                encuesta.getId(),
                usuario.getId(),
                opcionElegida.getId());
        if (existente.isPresent()) {
            encuestaVotoRepository.deleteByEncuestaIdAndUsuarioIdAndOpcionId(encuesta.getId(), usuario.getId(), opcionElegida.getId());
            return;
        }
        persistVoteSafe(encuesta, opcionElegida, usuario);
    }

    private void persistVoteSafe(EncuestaEntity encuesta, EncuestaOpcionEntity opcionElegida, UsuarioEntity usuario) {
        EncuestaVotoEntity voto = new EncuestaVotoEntity();
        voto.setEncuesta(encuesta);
        voto.setOpcion(opcionElegida);
        voto.setUsuario(usuario);
        voto.setCreatedAt(LocalDateTime.now());
        try {
            encuestaVotoRepository.save(voto);
        } catch (DataIntegrityViolationException ex) {
            LOGGER.info("[ENCUESTA_VOTO] voto duplicado ignorado encuestaId={} opcionId={} userId={}",
                    encuesta.getId(),
                    opcionElegida.getId(),
                    usuario.getId());
        }
    }

    private void recalculateAndPersistCounts(Long encuestaId, List<EncuestaOpcionEntity> opciones) {
        Map<Long, Long> countsByOption = encuestaVotoRepository.countByEncuestaGroupedByOpcion(encuestaId).stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new));
        for (EncuestaOpcionEntity opcion : opciones) {
            if (opcion == null || opcion.getId() == null) {
                continue;
            }
            opcion.setVoteCount(countsByOption.getOrDefault(opcion.getId(), 0L));
        }
        encuestaOpcionRepository.saveAll(opciones);
    }

    private EncuestaOpcionEntity resolveOpcion(Long encuestaId, String optionId, List<EncuestaOpcionEntity> opciones) {
        String normalized = optionId == null ? null : optionId.trim();
        if (normalized == null || normalized.isBlank()) {
            throw new IllegalArgumentException("optionId es obligatorio");
        }
        Optional<EncuestaOpcionEntity> byKey = encuestaOpcionRepository.findByEncuestaIdAndOptionKey(encuestaId, normalized);
        if (byKey.isPresent()) {
            return byKey.get();
        }
        if (opciones != null) {
            Optional<EncuestaOpcionEntity> fromList = opciones.stream()
                    .filter(Objects::nonNull)
                    .filter(op -> normalized.equalsIgnoreCase(safeTrim(op.getOptionKey())))
                    .findFirst();
            if (fromList.isPresent()) {
                return fromList.get();
            }
        }
        try {
            Long optionNumericId = Long.parseLong(normalized);
            return encuestaOpcionRepository.findByIdAndEncuestaId(optionNumericId, encuestaId)
                    .orElseThrow(() -> new RecursoNoEncontradoException("No existe la opcion de encuesta: " + optionId));
        } catch (NumberFormatException ex) {
            throw new RecursoNoEncontradoException("No existe la opcion de encuesta: " + optionId);
        }
    }

    private EncuestaDTO buildSnapshot(EncuestaEntity encuesta,
                                      List<EncuestaOpcionEntity> opciones,
                                      List<EncuestaVotoEntity> votos,
                                      Long usuarioId,
                                      boolean incluirIdsVotantes) {
        EncuestaDTO snapshot = new EncuestaDTO();
        snapshot.setType(POLL_V1);
        snapshot.setQuestion(encuesta.getQuestion());
        snapshot.setAllowMultiple(encuesta.isAllowMultiple());
        snapshot.setCreatedAt(encuesta.getCreatedAt());
        snapshot.setCreatedBy(encuesta.getCreatedBy() == null ? null : encuesta.getCreatedBy().getId());

        Map<Long, List<EncuestaVotoEntity>> votosPorOpcion = votos.stream()
                .filter(v -> v.getOpcion() != null && v.getOpcion().getId() != null)
                .collect(Collectors.groupingBy(
                        v -> v.getOpcion().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<EncuestaOpcionDTO> opcionesSnapshot = new ArrayList<>();
        long totalVotes = 0L;
        List<EncuestaOpcionEntity> opcionesOrdenadas = new ArrayList<>(opciones);
        opcionesOrdenadas.sort(Comparator.comparing(EncuestaOpcionEntity::getOrderIndex).thenComparing(EncuestaOpcionEntity::getId));

        for (EncuestaOpcionEntity opcion : opcionesOrdenadas) {
            List<EncuestaVotoEntity> votosOpcion = votosPorOpcion.getOrDefault(opcion.getId(), List.of());
            List<EncuestaVotoEntity> votosNormalizados = normalizarVotosUnicosPorUsuario(votosOpcion);
            List<EncuestaVotanteDTO> voters = votosNormalizados.stream()
                    .map(this::toEncuestaVotanteDTO)
                    .collect(Collectors.toList());
            List<Long> voterIds = voters.stream()
                    .map(EncuestaVotanteDTO::getUserId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());
            long voteCount = voters.size();
            totalVotes += voteCount;

            EncuestaOpcionDTO opcionDto = new EncuestaOpcionDTO();
            opcionDto.setId(resolveOutputOptionId(opcion));
            opcionDto.setText(opcion.getOptionText());
            opcionDto.setVoteCount(voteCount);
            opcionDto.setVoters(voters);
            opcionDto.setVoterIds(voterIds);
            if (usuarioId != null) {
                boolean votedByMe = voterIds.stream().anyMatch(id -> Objects.equals(id, usuarioId));
                opcionDto.setVotedByMe(votedByMe);
            }
            opcionesSnapshot.add(opcionDto);
        }

        snapshot.setOptions(opcionesSnapshot);
        snapshot.setTotalVotes(totalVotes);
        snapshot.setStatusText(totalVotes == 1 ? "1 voto" : totalVotes + " votos");
        return snapshot;
    }

    private String resolveOutputOptionId(EncuestaOpcionEntity opcion) {
        String optionKey = normalizeText(opcion.getOptionKey());
        if (optionKey != null) {
            return optionKey;
        }
        return opcion.getId() == null ? null : String.valueOf(opcion.getId());
    }

    private EncuestaDTO resolveEncuestaEntrada(MensajeDTO dto) {
        if (dto.getPoll() != null) {
            return dto.getPoll();
        }
        if (dto.getContenido() != null && !dto.getContenido().isBlank()) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(dto.getContenido());
                if (root != null && root.has("question") && root.has("options")) {
                    return OBJECT_MAPPER.treeToValue(root, EncuestaDTO.class);
                }
            } catch (Exception ignored) {
                // El contenido suele venir cifrado, por lo que el metadata poll se toma de dto.poll.
            }
        }
        throw new IllegalArgumentException("Payload de encuesta sin metadata poll");
    }

    private LocalDateTime resolveCreatedAt(EncuestaDTO dto, MensajeEntity mensaje) {
        if (dto != null && dto.getCreatedAt() != null) {
            return dto.getCreatedAt();
        }
        if (mensaje != null && mensaje.getFechaEnvio() != null) {
            return mensaje.getFechaEnvio();
        }
        return LocalDateTime.now();
    }

    private String normalizeOptionKey(String rawOptionId, int index, Set<String> keysUsadas) {
        String base = normalizeText(rawOptionId);
        if (base == null) {
            base = "opcion-" + (index + 1);
        }
        String candidate = base;
        int suffix = 1;
        while (keysUsadas.contains(candidate)) {
            candidate = base + "-" + suffix;
            suffix++;
        }
        keysUsadas.add(candidate);
        return candidate;
    }

    private boolean equalsIgnoreCaseSafe(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String safeTrim(String value) {
        return value == null ? null : value.trim();
    }

    private List<EncuestaVotoEntity> normalizarVotosUnicosPorUsuario(List<EncuestaVotoEntity> votosOpcion) {
        if (votosOpcion == null || votosOpcion.isEmpty()) {
            return List.of();
        }
        List<EncuestaVotoEntity> ordenados = new ArrayList<>(votosOpcion);
        ordenados.sort(Comparator
                .comparing(EncuestaVotoEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(EncuestaVotoEntity::getId, Comparator.nullsLast(Comparator.naturalOrder())));

        Map<Long, EncuestaVotoEntity> porUsuario = new LinkedHashMap<>();
        for (EncuestaVotoEntity voto : ordenados) {
            Long userId = voto.getUsuario() == null ? null : voto.getUsuario().getId();
            if (userId == null) {
                continue;
            }
            EncuestaVotoEntity existente = porUsuario.get(userId);
            if (existente == null) {
                porUsuario.put(userId, voto);
                continue;
            }
            LocalDateTime fechaExistente = existente.getCreatedAt();
            LocalDateTime fechaNueva = voto.getCreatedAt();
            boolean nuevaEsMasReciente = fechaExistente == null
                    || (fechaNueva != null && fechaNueva.isAfter(fechaExistente));
            if (nuevaEsMasReciente) {
                porUsuario.put(userId, voto);
            }
        }
        return new ArrayList<>(porUsuario.values());
    }

    private EncuestaVotanteDTO toEncuestaVotanteDTO(EncuestaVotoEntity voto) {
        EncuestaVotanteDTO dto = new EncuestaVotanteDTO();
        UsuarioEntity usuario = voto == null ? null : voto.getUsuario();
        dto.setUserId(usuario == null ? null : usuario.getId());
        dto.setFullName(buildNombreCompleto(usuario));
        dto.setPhotoUrl(usuario == null ? null : normalizeText(usuario.getFotoUrl()));
        dto.setVotedAt(formatUtcIso(voto == null ? null : voto.getCreatedAt()));
        return dto;
    }

    private String buildNombreCompleto(UsuarioEntity usuario) {
        if (usuario == null) {
            return null;
        }
        String nombre = normalizeText(usuario.getNombre());
        String apellido = normalizeText(usuario.getApellido());
        if (nombre == null && apellido == null) {
            return null;
        }
        if (nombre == null) {
            return apellido;
        }
        if (apellido == null) {
            return nombre;
        }
        return nombre + " " + apellido;
    }

    private String formatUtcIso(LocalDateTime fechaLocal) {
        if (fechaLocal == null) {
            return null;
        }
        return fechaLocal
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .truncatedTo(ChronoUnit.SECONDS)
                .toString();
    }

    private MensajeDTO buildMensajeEncuestaActualizado(MensajeEntity mensaje) {
        MensajeDTO dto = MappingUtils.mensajeEntityADto(mensaje);
        if (mensaje.getEmisor() != null) {
            dto.setEmisorNombre(mensaje.getEmisor().getNombre());
            dto.setEmisorApellido(mensaje.getEmisor().getApellido());
            dto.setEmisorFoto(mensaje.getEmisor().getFotoUrl());
        }
        dto.setTipo(Constantes.TIPO_POLL);
        dto.setContentKind(CONTENT_KIND_POLL);
        dto.setPollType(POLL_V1);
        return dto;
    }
}
