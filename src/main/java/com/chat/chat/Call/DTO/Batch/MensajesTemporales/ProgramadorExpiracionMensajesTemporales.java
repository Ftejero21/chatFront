package com.chat.chat.Call.DTO.Batch.MensajesTemporales;

import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.MensajeTemporalAuditoriaEntity;
import com.chat.chat.Repository.MensajeReaccionRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.MensajeTemporalAuditoriaRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.Utils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ProgramadorExpiracionMensajesTemporales {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProgramadorExpiracionMensajesTemporales.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String MOTIVO_TEMPORAL_EXPIRADO = "TEMPORAL_EXPIRADO";

    private final MensajeRepository mensajeRepository;
    private final MensajeReaccionRepository mensajeReaccionRepository;
    private final MensajeTemporalAuditoriaRepository mensajeTemporalAuditoriaRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.mensajes.temporales.cleanup.enabled:true}")
    private boolean habilitado;

    @Value("${app.mensajes.temporales.cleanup.batch-size:500}")
    private int tamanoLote;

    @Value("${app.mensajes.temporales.cleanup.max-lotes-por-ejecucion:10}")
    private int maxLotesPorEjecucion;

    @Value("${app.mensajes.temporales.cleanup.retencion-tecnica-dias:0}")
    private int retencionTecnicaDias;

    @Value("${app.mensajes.temporales.cleanup.limpieza-tecnica.batch-size:500}")
    private int tamanoLoteLimpiezaTecnica;

    @Value(Constantes.PROP_UPLOADS_ROOT)
    private String uploadsRoot;

    public ProgramadorExpiracionMensajesTemporales(MensajeRepository mensajeRepository,
                                                   MensajeReaccionRepository mensajeReaccionRepository,
                                                   MensajeTemporalAuditoriaRepository mensajeTemporalAuditoriaRepository,
                                                   SimpMessagingTemplate messagingTemplate) {
        this.mensajeRepository = mensajeRepository;
        this.mensajeReaccionRepository = mensajeReaccionRepository;
        this.mensajeTemporalAuditoriaRepository = mensajeTemporalAuditoriaRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(
            fixedDelayString = "${app.mensajes.temporales.cleanup.fixed-delay-ms:60000}",
            initialDelayString = "${app.mensajes.temporales.cleanup.initial-delay-ms:30000}"
    )
    public void expirarMensajesTemporales() {
        if (!habilitado) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();
        int loteSeguro = Math.max(1, tamanoLote);
        int maxLotesSeguro = Math.max(1, maxLotesPorEjecucion);
        long totalEncontrados = 0;
        long totalExpirados = 0;
        long totalErrores = 0;

        for (int i = 0; i < maxLotesSeguro; i++) {
            List<MensajeEntity> pendientes = mensajeRepository.findMensajesTemporalesPendientesExpirar(
                    ahora,
                    MOTIVO_TEMPORAL_EXPIRADO,
                    PageRequest.of(0, loteSeguro));
            if (pendientes.isEmpty()) {
                break;
            }

            totalEncontrados += pendientes.size();
            List<Long> ids = pendientes.stream()
                    .map(MensajeEntity::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            if (ids.isEmpty()) {
                break;
            }

            Set<Path> adjuntosLocales = recolectarAdjuntosLocales(pendientes);
            try {
                mensajeReaccionRepository.deleteByMensajeIdIn(ids);
                for (MensajeEntity mensaje : pendientes) {
                    guardarAuditoriaOriginalSiNoExiste(mensaje);
                    aplicarPlaceholderExpirado(mensaje);
                }
                mensajeRepository.saveAll(pendientes);
                totalExpirados += pendientes.size();

                pendientes.forEach(this::emitirActualizacionEnTiempoReal);
            } catch (Exception ex) {
                totalErrores += pendientes.size();
                LOGGER.error("[BATCH_TEMPORALES] Error expirando lote temporal. ids={} error={}",
                        ids,
                        ex.getClass().getSimpleName());
                continue;
            }

            totalErrores += limpiarAdjuntosLocales(adjuntosLocales);
            if (pendientes.size() < loteSeguro) {
                break;
            }
        }

        int erroresLimpiezaTecnica = ejecutarLimpiezaTecnicaOpcional(ahora);
        totalErrores += erroresLimpiezaTecnica;

        if (totalEncontrados > 0 || totalErrores > 0) {
            LOGGER.info("[BATCH_TEMPORALES] encontrados={} expirados={} errores={}",
                    totalEncontrados,
                    totalExpirados,
                    totalErrores);
        }
    }

    private void aplicarPlaceholderExpirado(MensajeEntity mensaje) {
        String placeholder = mensaje.getPlaceholderTexto();
        if (placeholder == null || placeholder.isBlank()) {
            placeholder = Utils.construirPlaceholderTemporal(mensaje.getMensajeTemporalSegundos());
        }
        mensaje.setActivo(false);
        mensaje.setFechaEliminacion(LocalDateTime.now(java.time.ZoneOffset.UTC));
        mensaje.setLeido(true);
        mensaje.setTipo(com.chat.chat.Utils.MessageType.TEXT);
        mensaje.setContenido(placeholder);
        mensaje.setPlaceholderTexto(placeholder);
        mensaje.setMotivoEliminacion(MOTIVO_TEMPORAL_EXPIRADO);
        mensaje.setMediaUrl(null);
        mensaje.setMediaMime(null);
        mensaje.setMediaDuracionMs(null);
        mensaje.setMediaSizeBytes(null);
    }

    private void emitirActualizacionEnTiempoReal(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getId() == null) {
            return;
        }
        try {
            var dto = MappingUtils.mensajeEntityADto(mensaje);
            dto.setSystemEvent("TEMPORAL_MESSAGE_EXPIRED");

            ChatEntity chat = mensaje.getChat();
            if (chat instanceof ChatGrupalEntity) {
                if (chat.getId() != null) {
                    messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT_GRUPAL + chat.getId(), dto);
                }
                return;
            }

            Long emisorId = mensaje.getEmisor() == null ? null : mensaje.getEmisor().getId();
            Long receptorId = mensaje.getReceptor() == null ? null : mensaje.getReceptor().getId();
            if (emisorId != null) {
                messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + emisorId, dto);
            }
            if (receptorId != null) {
                messagingTemplate.convertAndSend(Constantes.TOPIC_CHAT + receptorId, dto);
            }
        } catch (Exception ex) {
            LOGGER.warn("[BATCH_TEMPORALES] No se pudo emitir evento WS de expiracion para mensaje {}: {}",
                    mensaje.getId(),
                    ex.getClass().getSimpleName());
        }
    }

    private void guardarAuditoriaOriginalSiNoExiste(MensajeEntity mensaje) {
        if (mensaje == null || mensaje.getId() == null) {
            return;
        }
        if (mensajeTemporalAuditoriaRepository.findByMensajeId(mensaje.getId()).isPresent()) {
            return;
        }

        MensajeTemporalAuditoriaEntity auditoria = new MensajeTemporalAuditoriaEntity();
        auditoria.setMensajeId(mensaje.getId());
        auditoria.setChatId(mensaje.getChat() == null ? null : mensaje.getChat().getId());
        auditoria.setContenidoOriginal(mensaje.getContenido());
        auditoria.setTipoOriginal(mensaje.getTipo() == null ? null : mensaje.getTipo().name());
        auditoria.setMediaUrlOriginal(mensaje.getMediaUrl());
        auditoria.setMediaMimeOriginal(mensaje.getMediaMime());
        auditoria.setMediaDuracionMsOriginal(mensaje.getMediaDuracionMs());
        auditoria.setReenviado(mensaje.isReenviado());
        auditoria.setMensajeOriginalId(mensaje.getMensajeOriginalId());
        auditoria.setReplyToMessageId(mensaje.getReplyToMessageId());
        auditoria.setReplySnippet(mensaje.getReplySnippet());
        auditoria.setReplyAuthorName(mensaje.getReplyAuthorName());
        auditoria.setFechaEnvioOriginal(mensaje.getFechaEnvio());
        auditoria.setExpiraEnOriginal(mensaje.getExpiraEn());
        auditoria.setEstadoTemporalOriginal("EXPIRADO");

        UrlsAuditoria urls = extraerUrlsAuditoria(mensaje);
        auditoria.setAudioUrlOriginal(urls.audioUrl());
        auditoria.setImageUrlOriginal(urls.imageUrl());
        auditoria.setFileUrlOriginal(urls.fileUrl());

        mensajeTemporalAuditoriaRepository.save(auditoria);
    }

    private UrlsAuditoria extraerUrlsAuditoria(MensajeEntity mensaje) {
        String audioUrl = null;
        String imageUrl = null;
        String fileUrl = null;
        if (mensaje != null && mensaje.getTipo() != null) {
            switch (mensaje.getTipo()) {
                case AUDIO -> audioUrl = mensaje.getMediaUrl();
                case IMAGE -> imageUrl = mensaje.getMediaUrl();
                case FILE -> fileUrl = mensaje.getMediaUrl();
                default -> {
                    // no-op
                }
            }
        }
        String contenido = mensaje == null ? null : mensaje.getContenido();
        if (contenido != null && !contenido.isBlank()) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(contenido);
                if (audioUrl == null || audioUrl.isBlank()) {
                    audioUrl = root.path("audioUrl").asText(null);
                }
                if (imageUrl == null || imageUrl.isBlank()) {
                    imageUrl = root.path("imageUrl").asText(null);
                }
                if (fileUrl == null || fileUrl.isBlank()) {
                    fileUrl = root.path("fileUrl").asText(null);
                    if (fileUrl == null || fileUrl.isBlank()) {
                        fileUrl = root.path("url").asText(null);
                    }
                }
            } catch (Exception ignored) {
                // contenido no JSON: usamos solo mediaUrl principal.
            }
        }
        return new UrlsAuditoria(audioUrl, imageUrl, fileUrl);
    }

    private int ejecutarLimpiezaTecnicaOpcional(LocalDateTime ahora) {
        if (retencionTecnicaDias <= 0) {
            return 0;
        }
        int errores = 0;
        LocalDateTime cutoff = ahora.minusDays(retencionTecnicaDias);
        int lote = Math.max(1, tamanoLoteLimpiezaTecnica);
        List<MensajeEntity> candidatos = mensajeRepository.findPlaceholdersParaLimpiezaTecnica(
                MOTIVO_TEMPORAL_EXPIRADO,
                cutoff,
                PageRequest.of(0, lote));
        if (candidatos.isEmpty()) {
            return 0;
        }
        List<Long> ids = candidatos.stream()
                .map(MensajeEntity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return 0;
        }
        try {
            mensajeRepository.eliminarPorIds(ids);
        } catch (Exception ex) {
            errores += ids.size();
            LOGGER.warn("[BATCH_TEMPORALES] Error en limpieza tecnica de placeholders ids={} error={}",
                    ids,
                    ex.getClass().getSimpleName());
        }
        return errores;
    }

    private Set<Path> recolectarAdjuntosLocales(List<MensajeEntity> mensajes) {
        Set<Path> rutas = new LinkedHashSet<>();
        for (MensajeEntity mensaje : mensajes) {
            if (mensaje == null) {
                continue;
            }
            agregarRutaLocalSiCorresponde(mensaje.getMediaUrl(), rutas);
            agregarRutasDesdeContenido(mensaje.getContenido(), rutas);
        }
        return rutas;
    }

    private void agregarRutasDesdeContenido(String contenido, Set<Path> rutas) {
        if (contenido == null || contenido.isBlank()) {
            return;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(contenido);
            agregarRutaLocalSiCorresponde(root.path("audioUrl").asText(null), rutas);
            agregarRutaLocalSiCorresponde(root.path("imageUrl").asText(null), rutas);
            agregarRutaLocalSiCorresponde(root.path("mediaUrl").asText(null), rutas);
            agregarRutaLocalSiCorresponde(root.path("fileUrl").asText(null), rutas);
            agregarRutaLocalSiCorresponde(root.path("url").asText(null), rutas);
        } catch (Exception ignored) {
            // Si no es JSON, no hay rutas adicionales que extraer.
        }
    }

    private void agregarRutaLocalSiCorresponde(String urlPublica, Set<Path> rutas) {
        if (urlPublica == null || urlPublica.isBlank() || !urlPublica.startsWith(Constantes.UPLOADS_PREFIX)) {
            return;
        }

        String relativa = urlPublica.substring(Constantes.UPLOADS_PREFIX.length());
        Path raiz = Paths.get(uploadsRoot).toAbsolutePath().normalize();
        Path archivo = raiz.resolve(relativa).normalize();
        if (!archivo.startsWith(raiz)) {
            return;
        }
        rutas.add(archivo);
    }

    private int limpiarAdjuntosLocales(Set<Path> rutas) {
        int errores = 0;
        for (Path ruta : rutas) {
            try {
                Files.deleteIfExists(ruta);
            } catch (Exception ex) {
                errores++;
                LOGGER.warn("[BATCH_TEMPORALES] No se pudo limpiar adjunto local {}: {}", ruta, ex.getClass().getSimpleName());
            }
        }
        return errores;
    }

    private record UrlsAuditoria(String audioUrl, String imageUrl, String fileUrl) {
    }
}
