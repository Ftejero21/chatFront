package com.chat.chat.Utils;

import com.chat.chat.DTO.ChatGrupalDTO;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.UsuarioRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.data.repository.CrudRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class Utils {

    private static final String DATA_URL_PREFIX = "data:";
    private static final String DATA_URL_BASE64 = ";base64,";
    private static final String UPLOADS_REGEX_PREFIX = "^/uploads/?";
    private static final String UPLOADS_PREFIX = "/uploads/";
    private static final String HTTP_PREFIX = "http://";
    private static final String HTTPS_PREFIX = "https://";
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_JPG = "image/jpg";
    private static final String MIME_PNG = "image/png";
    private static final String MIME_WEBP = "image/webp";
    private static final String MIME_OCTET = "application/octet-stream";
    private static final String EXT_JPG = ".jpg";
    private static final String EXT_JPEG = ".jpeg";
    private static final String EXT_PNG = ".png";
    private static final String EXT_WEBP = ".webp";
    private static final String EXT_WEBM = ".webm";
    private static final String EXT_OGG = ".ogg";
    private static final String EXT_MP3 = ".mp3";
    private static final String EXT_M4A = ".m4a";
    private static final String EXT_AAC = ".aac";
    private static final String AUDIO_WEBM = "audio/webm";
    private static final String AUDIO_WEBM_OPUS = "audio/webm;codecs=opus";
    private static final String AUDIO_OGG = "audio/ogg";
    private static final String AUDIO_OGG_OPUS = "audio/ogg;codecs=opus";
    private static final String AUDIO_MPEG = "audio/mpeg";
    private static final String AUDIO_MP4 = "audio/mp4";
    private static final String AUDIO_AAC = "audio/aac";
    private static final String EMPTY = "";
    private static final String SPACE = " ";
    private static final String COMMA = ",";
    private static final String REGEX_SLASHES_START = "^/+";
    private static final String REGEX_SLASHES_END = "/+$";
    private static final String REGEX_DOT_DOT = "..";
    private static final String SLASH = "/";
    private static final String DOT = ".";
    private static final String DEFAULT_TRUNCATE_SUFFIX = "...";
    private static final String ERROR_DTO_NULL = "El DTO no puede ser null";
    private static final String ERROR_ID_CREADOR = "idCreador es obligatorio";
    private static final String ERROR_CREADOR_NO_EXISTE = "Creador no existe: ";
    private static final String ERROR_USER_ID_REQUERIDO = "userId requerido";
    private static final String ERROR_JSON = "Error serializando JSON";
    private static final String ERROR_DATA_URL = "Data URL inválido";
    private static final String ERROR_GUARDAR_IMAGEN = "No se pudo guardar la imagen";
    private static final String ERROR_NO_EXISTE_SUFFIX = " no existe: ";
    private static final String TIME_MMSS_FORMAT = "%02d:%02d";
    private static final String EXT_JPG_NO_DOT = "jpg";
    private static final String EXT_WEBP_NO_DOT = "webp";
    private static final String EXT_PNG_NO_DOT = "png";


    // ObjectMapper thread-safe si lo reutilizas así
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /**
     * Convierte una URL pública tipo "/uploads/avatars/xx.png" en dataURL "data:image/...;base64,..."
     * @param publicUrl   ej: "/uploads/avatars/xx.png"
     * @param uploadsRoot ej: "uploads" (ruta raíz física en disco)
     */
    public static String toDataUrlFromUrl(String publicUrl, String uploadsRoot) {
        try {
            if (publicUrl == null || publicUrl.isBlank()) return null;

            String relative = publicUrl.replaceFirst(UPLOADS_REGEX_PREFIX, EMPTY); // "avatars/xx.png"
            Path file = Paths.get(uploadsRoot, relative).normalize().toAbsolutePath();

            byte[] bytes = Files.readAllBytes(file);

            String mime = Files.probeContentType(file);
            if (mime == null) {
                String name = file.getFileName().toString().toLowerCase();
                if (name.endsWith(EXT_JPG) || name.endsWith(EXT_JPEG)) mime = MIME_JPEG;
                else if (name.endsWith(EXT_PNG)) mime = MIME_PNG;
                else if (name.endsWith(EXT_WEBP)) mime = MIME_WEBP;
                else mime = MIME_OCTET;
            }

            String base64 = Base64.getEncoder().encodeToString(bytes);
            return DATA_URL_PREFIX + mime + DATA_URL_BASE64 + base64;
        } catch (Exception e) {
            return null;
        }
    }

    public static UsuarioEntity getCreadorOrThrow(ChatGrupalDTO dto, UsuarioRepository usuarioRepo) {
        if (dto == null) throw new IllegalArgumentException(ERROR_DTO_NULL);
        Long idCreador = dto.getIdCreador();
        if (idCreador == null) {
            throw new IllegalArgumentException(ERROR_ID_CREADOR);
        }
        return usuarioRepo.findById(idCreador)
                .orElseThrow(() -> new IllegalArgumentException(ERROR_CREADOR_NO_EXISTE + idCreador));
    }

    /** Carga una entidad por id o lanza IllegalArgumentException con mensaje claro. */
    public static <T, ID> T getByIdOrThrow(CrudRepository<T, ID> repo, ID id, String label) {
        return optionalOrThrow(repo.findById(id), label + ERROR_NO_EXISTE_SUFFIX + id);
    }

    public static boolean isPublicUrl(String v) {
        if (v == null) return false;
        String s = v.trim();
        return s.startsWith(UPLOADS_PREFIX) || s.startsWith(HTTP_PREFIX) || s.startsWith(HTTPS_PREFIX);
    }

    public static <T> T optionalOrThrow(Optional<T> opt, String msg) {
        return opt.orElseThrow(() -> new IllegalArgumentException(msg));
    }

    private static final Map<String,String> EXT_BY_MIME = Map.of(
            AUDIO_WEBM, EXT_WEBM,
            AUDIO_WEBM_OPUS, EXT_WEBM,
            AUDIO_OGG, EXT_OGG,
            AUDIO_OGG_OPUS, EXT_OGG,
            AUDIO_MPEG, EXT_MP3,
            AUDIO_MP4, EXT_M4A,
            AUDIO_AAC, EXT_AAC
    );

    public static String extensionFor(String contentType, String defaultExt) {
        if (contentType == null) return defaultExt;
        String ext = EXT_BY_MIME.get(contentType.toLowerCase());
        return (ext != null ? ext : defaultExt);
    }

    public static String extensionFor(String contentType) {
        return extensionFor(contentType, EXT_WEBM);
    }

    public static String mmss(Integer ms) {
        if (ms == null || ms <= 0) return EMPTY;
        int total = ms / 1000;
        int m = total / 60;
        int s = total % 60;
        return String.format(TIME_MMSS_FORMAT, m, s);
    }

    public static String descripcionDuracionTemporal(Long segundos) {
        if (segundos == null || segundos <= 0) {
            return "unos instantes";
        }
        long s = segundos;
        if (s % 86_400L == 0) {
            long dias = s / 86_400L;
            return dias == 1 ? "1 dia" : dias + " dias";
        }
        if (s % 3_600L == 0) {
            long horas = s / 3_600L;
            return horas == 1 ? "1 hora" : horas + " horas";
        }
        if (s % 60L == 0) {
            long minutos = s / 60L;
            return minutos == 1 ? "1 minuto" : minutos + " minutos";
        }
        return s == 1 ? "1 segundo" : s + " segundos";
    }

    public static String construirPlaceholderTemporal(Long segundos) {
        return "Se trataba de un mensaje temporal que solo estaba disponible los primeros "
                + descripcionDuracionTemporal(segundos);
    }

    // evita NPE si contenido es null antes de truncar
    public static String truncarSafe(String s, int max) {
        if (s == null) return EMPTY;
        if (s.length() <= max) return s;
        return s.substring(0, Math.max(0, max)).trim() + DEFAULT_TRUNCATE_SUFFIX;
    }

    /** Envía a /topic/notifications.{userId} */
    public static void sendNotif(SimpMessagingTemplate messagingTemplate, Long userId, Object payload) {
        if (userId == null) throw new IllegalArgumentException(ERROR_USER_ID_REQUERIDO);
        messagingTemplate.convertAndSend(Constantes.WS_TOPIC_NOTIFICATIONS + userId, payload);
    }

    public static String writeJson(Object o) {
        try {
            return MAPPER.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(ERROR_JSON, e);
        }
    }

    /**
     * Guarda un dataURL (ej: "data:image/png;base64,AAA...") en /{uploadsRoot}/{folder}/
     * y devuelve la URL pública (ej: "/uploads/{folder}/{uuid}.png").
     *
     * @param dataUrl         data URL completo ("data:image/...;base64,...")
     * @param folder          subcarpeta (ej: "avatars")
     * @param uploadsRoot     raíz física (ej: "uploads")
     * @param uploadsBaseUrl  raíz pública (ej: "/uploads")
     */
    public static String saveDataUrlToUploads(String dataUrl, String folder, String uploadsRoot, String uploadsBaseUrl) {
        try {
            if (dataUrl == null || !dataUrl.startsWith(DATA_URL_PREFIX) || !dataUrl.contains(COMMA)) {
                throw new IllegalArgumentException(ERROR_DATA_URL);
            }

            // data:image/png;base64,xxxx
            String[] parts = dataUrl.split(COMMA, 2);
            String meta = parts[0];   // "data:image/png;base64"
            String base64 = parts[1];

            String ext = guessExtFromMeta(meta);
            byte[] bytes = Base64.getDecoder().decode(base64);

            // evitar path traversal en folder
            String safeFolder = folder.replace("\\", "/").replace(REGEX_DOT_DOT, EMPTY).replaceAll(REGEX_SLASHES_START, EMPTY).replaceAll(REGEX_SLASHES_END, EMPTY);

            Path dir = Paths.get(uploadsRoot, safeFolder).normalize().toAbsolutePath();
            Files.createDirectories(dir);

            String filename = UUID.randomUUID().toString() + DOT + ext;
            Path file = dir.resolve(filename);
            Files.write(file, bytes);

            String baseClean = uploadsBaseUrl.replaceAll(REGEX_SLASHES_END, EMPTY);
            return baseClean + SLASH + safeFolder + SLASH + filename;
        } catch (Exception e) {
            throw new RuntimeException(ERROR_GUARDAR_IMAGEN, e);
        }
    }

    private static String guessExtFromMeta(String meta) {
        String m = meta.toLowerCase();
        if (m.contains(MIME_JPEG) || m.contains(MIME_JPG)) return EXT_JPG_NO_DOT;
        if (m.contains(MIME_WEBP)) return EXT_WEBP_NO_DOT;
        if (m.contains(MIME_PNG)) return EXT_PNG_NO_DOT;
        return EXT_PNG_NO_DOT; // por defecto
    }
}
