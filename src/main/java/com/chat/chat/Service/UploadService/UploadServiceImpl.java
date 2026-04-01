package com.chat.chat.Service.UploadService;

import com.chat.chat.DTO.AudioUploadResponseDTO;
import com.chat.chat.DTO.FileUploadResponseDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Exceptions.UploadSecurityException;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Security.ClientIpResolver;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.SecurityUtils;
import com.chat.chat.Utils.Utils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.UUID;
import java.util.Set;
import java.util.Locale;
import java.util.LinkedHashSet;
import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UploadServiceImpl implements UploadService {

    private static final Logger LOGGER = LoggerFactory.getLogger(UploadServiceImpl.class);
    private static final long DEFAULT_MAX_UPLOAD_BYTES = 25L * 1024L * 1024L;
    private static final Set<String> DEFAULT_AUDIO_EXTENSIONS = Set.of(".webm", ".ogg", ".mp3", ".wav", ".m4a", ".aac", ".opus");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final String uploadsRoot;
    private final String uploadsBaseUrl;
    private final long maxUploadBytes;
    private final Set<String> allowedMimeSet;
    private final Set<String> allowedExtSet;
    private final Set<String> blockedExtSet;
    private final boolean antivirusEnabled;
    private final String antivirusCommand;
    private final String quarantineDir;
    private final ClientIpResolver clientIpResolver;
    private final SecurityUtils securityUtils;
    private final ChatIndividualRepository chatIndividualRepository;
    private final ChatGrupalRepository chatGrupalRepository;
    private final MensajeRepository mensajeRepository;

    public UploadServiceImpl(@Value(Constantes.PROP_UPLOADS_ROOT) String uploadsRoot,
                             @Value(Constantes.PROP_UPLOADS_BASE_URL) String uploadsBaseUrl,
                             @Value("${app.uploads.security.max-file-bytes:26214400}") Long maxUploadBytes,
                             @Value("${app.uploads.security.allowed-mimes:application/octet-stream,image/png,image/jpeg,image/webp,image/gif,audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/mp4,application/pdf,text/plain,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}") String allowedMimes,
                             @Value("${app.uploads.security.allowed-extensions:.bin,.png,.jpg,.jpeg,.webp,.gif,.webm,.ogg,.mp3,.wav,.m4a,.aac,.opus,.pdf,.txt,.zip,.doc,.docx}") String allowedExtensions,
                             @Value("${app.uploads.security.blocked-extensions:.exe,.msi,.bat,.cmd,.ps1,.js,.vbs,.jar,.com,.scr,.pif,.reg,.sh}") String blockedExtensions,
                             @Value("${app.uploads.security.antivirus.enabled:false}") boolean antivirusEnabled,
                             @Value("${app.uploads.security.antivirus.command:}") String antivirusCommand,
                             @Value("${app.uploads.security.antivirus.quarantine-dir:quarantine}") String quarantineDir,
                             ClientIpResolver clientIpResolver,
                             SecurityUtils securityUtils,
                             ChatIndividualRepository chatIndividualRepository,
                             ChatGrupalRepository chatGrupalRepository,
                             MensajeRepository mensajeRepository) {
        this.uploadsRoot = uploadsRoot;
        this.uploadsBaseUrl = uploadsBaseUrl;
        this.maxUploadBytes = maxUploadBytes == null || maxUploadBytes <= 0 ? DEFAULT_MAX_UPLOAD_BYTES : maxUploadBytes;
        this.allowedMimeSet = parseCsvToLowerSet(allowedMimes);
        this.allowedExtSet = parseExtensionsSet(allowedExtensions);
        this.blockedExtSet = parseExtensionsSet(blockedExtensions);
        this.antivirusEnabled = antivirusEnabled;
        this.antivirusCommand = antivirusCommand == null ? "" : antivirusCommand.trim();
        this.quarantineDir = (quarantineDir == null || quarantineDir.isBlank()) ? "quarantine" : quarantineDir.trim();
        this.clientIpResolver = clientIpResolver;
        this.securityUtils = securityUtils;
        this.chatIndividualRepository = chatIndividualRepository;
        this.chatGrupalRepository = chatGrupalRepository;
        this.mensajeRepository = mensajeRepository;
    }

    @Override
    public AudioUploadResponseDTO uploadAudio(MultipartFile file, Integer durMs, Long chatId, Long messageId) {
        UploadAuditContext audit = buildAuditContext("AUDIO_UPLOAD", chatId, messageId, file);
        validateUploadAccess(chatId, messageId, audit);
        byte[] bytes = readFileBytes(file, audit);
        validateSize(bytes.length, audit);
        String originalName = safeClientName(file == null ? null : file.getOriginalFilename());
        String detectedMime = detectMime(bytes, normalizeMime(file == null ? null : file.getContentType()), originalName);
        String extension = resolveSafeExtension(originalName, detectedMime, ".webm");
        validateAudioPolicy(detectedMime, extension, audit);
        runMalwareScanIfEnabled(bytes, extension, audit);
        String sha256 = sha256Hex(bytes);

        try {
            StoredFile stored = storeRawFile(bytes, Constantes.DIR_VOICE, extension, detectedMime);
            logUploadAudit("UPLOAD_OK", audit, detectedMime, bytes.length, sha256, stored.url(), null);

            AudioUploadResponseDTO dto = new AudioUploadResponseDTO();
            dto.setUrl(stored.url());
            dto.setMime(stored.mime());
            dto.setFileName(stored.fileName());
            dto.setSizeBytes(stored.sizeBytes());
            dto.setDurMs(durMs);
            return dto;

        } catch (IOException e) {
            logUploadAudit("UPLOAD_ERROR", audit, detectedMime, bytes.length, sha256, null, e.getClass().getSimpleName());
            throw new RuntimeException(ExceptionConstants.ERROR_AUDIO_SAVE_FAILED, e);
        }
    }

    @Override
    public FileUploadResponseDTO uploadEncryptedFile(MultipartFile file, Long chatId, Long messageId) {
        UploadAuditContext audit = buildAuditContext("FILE_UPLOAD", chatId, messageId, file);
        validateUploadAccess(chatId, messageId, audit);
        byte[] bytes = readFileBytes(file, audit);
        validateSize(bytes.length, audit);
        String originalName = safeClientName(file == null ? null : file.getOriginalFilename());
        String detectedMime = detectMime(bytes, normalizeMime(file == null ? null : file.getContentType()), originalName);
        String extension = resolveSafeExtension(originalName, detectedMime, ".bin");
        validateEncryptedFilePolicy(detectedMime, extension, audit);
        runMalwareScanIfEnabled(bytes, extension, audit);
        String sha256 = sha256Hex(bytes);

        try {
            StoredFile stored = storeRawFile(bytes, Constantes.DIR_MEDIA, extension, detectedMime);
            logUploadAudit("UPLOAD_OK", audit, detectedMime, bytes.length, sha256, stored.url(), null);
            FileUploadResponseDTO dto = new FileUploadResponseDTO();
            dto.setUrl(stored.url());
            dto.setMime(stored.mime());
            dto.setFileName(stored.fileName());
            dto.setSizeBytes(stored.sizeBytes());
            dto.setSha256(sha256);
            dto.setDownloadUrl(messageId == null ? null : buildDownloadUrl(stored.url(), chatId, messageId));
            return dto;
        } catch (IOException e) {
            logUploadAudit("UPLOAD_ERROR", audit, detectedMime, bytes.length, sha256, null, e.getClass().getSimpleName());
            throw new RuntimeException(ExceptionConstants.ERROR_FILE_SAVE_FAILED, e);
        }
    }

    @Override
    public ResponseEntity<Resource> downloadEncryptedFile(String url, Long chatId, Long messageId) {
        UploadAuditContext audit = buildAuditContext("FILE_DOWNLOAD", chatId, messageId, null);
        validateDownloadAccess(url, chatId, messageId, audit);
        Path filePath = resolvePublicUrlToPath(url, audit);
        try {
            byte[] bytes = Files.readAllBytes(filePath);
            String sha256 = sha256Hex(bytes);
            String mime = detectMime(bytes, normalizeMime(Files.probeContentType(filePath)), filePath.getFileName().toString());
            String downloadName = safeClientName(filePath.getFileName().toString());
            logUploadAudit("DOWNLOAD_OK", audit, mime, bytes.length, sha256, url, null);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + downloadName + "\"")
                    .header("X-Content-Type-Options", "nosniff")
                    .contentType(MediaType.parseMediaType(normalizeMime(mime)))
                    .contentLength(bytes.length)
                    .body(new ByteArrayResource(bytes));
        } catch (UploadSecurityException ex) {
            throw ex;
        } catch (Exception ex) {
            logUploadAudit("DOWNLOAD_ERROR", audit, null, 0L, null, url, ex.getClass().getSimpleName());
            throw new RuntimeException("Fallo al descargar archivo");
        }
    }

    private byte[] readFileBytes(MultipartFile file, UploadAuditContext audit) {
        if (file == null || file.isEmpty()) {
            throwSecurityBlock("empty", ExceptionConstants.ERROR_FILE_EMPTY, audit, null, null, null);
        }
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new RuntimeException(ExceptionConstants.ERROR_FILE_SAVE_FAILED, ex);
        }
    }

    private void validateAudioPolicy(String detectedMime, String extension, UploadAuditContext audit) {
        String normalizedMime = normalizeMime(detectedMime).toLowerCase(Locale.ROOT);
        String ext = normalizeExtension(extension);
        if (blockedExtSet.contains(ext)) {
            throwSecurityBlock("extension_blocked", "Extension bloqueada para audio: " + ext, audit, normalizedMime, ext, null);
        }
        boolean mimeLooksAudio = normalizedMime.startsWith("audio/");
        boolean extLooksAudio = DEFAULT_AUDIO_EXTENSIONS.contains(ext);
        if (!mimeLooksAudio && !extLooksAudio) {
            throwSecurityBlock("mime", ExceptionConstants.ERROR_FILE_TYPE_NOT_ALLOWED + detectedMime, audit, normalizedMime, ext, null);
        }
        if (!isAllowedMime(normalizedMime) || !isAllowedExtension(ext)) {
            throwSecurityBlock("policy", "Audio bloqueado por policy de MIME/ext", audit, normalizedMime, ext, null);
        }
    }

    private void validateEncryptedFilePolicy(String detectedMime, String extension, UploadAuditContext audit) {
        String normalizedMime = normalizeMime(detectedMime).toLowerCase(Locale.ROOT);
        String ext = normalizeExtension(extension);
        if (blockedExtSet.contains(ext)) {
            throwSecurityBlock("extension_blocked", "Extension bloqueada: " + ext, audit, normalizedMime, ext, null);
        }
        if (!isAllowedMime(normalizedMime) || !isAllowedExtension(ext)) {
            throwSecurityBlock("policy", "Archivo bloqueado por policy de MIME/ext", audit, normalizedMime, ext, null);
        }
    }

    private void validateSize(long sizeBytes, UploadAuditContext audit) {
        if (sizeBytes <= 0) {
            throwSecurityBlock("size", ExceptionConstants.ERROR_FILE_EMPTY, audit, null, null, sizeBytes);
        }
        if (sizeBytes > maxUploadBytes) {
            throwSecurityBlock("size", ExceptionConstants.ERROR_FILE_SIZE_EXCEEDED, audit, null, null, sizeBytes);
        }
    }

    private StoredFile storeRawFile(byte[] bytes, String subDir, String extension, String mime) throws IOException {
        Path destinationDir = prepareDirectory(subDir);
        String storedFileName = generateUniqueFileName(extension);
        Path destinationPath = destinationDir.resolve(storedFileName);

        // Importante para E2E: persistir bytes exactamente como llegan.
        try (InputStream inputStream = new ByteArrayInputStream(bytes)) {
            Files.copy(inputStream, destinationPath, StandardCopyOption.REPLACE_EXISTING);
        }

        String publicUrl = buildPublicUrl(subDir, storedFileName);
        return new StoredFile(
                publicUrl,
                normalizeMime(mime),
                storedFileName,
                (long) bytes.length);
    }

    private String resolveSafeExtension(String originalName, String detectedMime, String fallback) {
        String extOriginal = normalizeExtension(extensionFromOriginalName(originalName));
        if (extOriginal != null && !extOriginal.isBlank() && !blockedExtSet.contains(extOriginal) && isAllowedExtension(extOriginal)) {
            return extOriginal;
        }
        String fromMime = normalizeExtension(Utils.extensionFor(normalizeMime(detectedMime), fallback));
        if (fromMime != null && !fromMime.isBlank() && !blockedExtSet.contains(fromMime) && isAllowedExtension(fromMime)) {
            return fromMime;
        }
        String extFallback = normalizeExtension(fallback);
        if (extFallback == null || extFallback.isBlank() || blockedExtSet.contains(extFallback)) {
            return ".bin";
        }
        if (!isAllowedExtension(extFallback)) {
            return ".bin";
        }
        return extFallback;
    }

    private String detectMime(byte[] bytes, String clientMime, String originalName) {
        String detected = null;
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            detected = URLConnection.guessContentTypeFromStream(in);
        } catch (IOException ignored) {
            detected = null;
        }
        if (detected == null || detected.isBlank()) {
            String ext = extensionFromOriginalName(originalName);
            detected = extToMime(ext);
        }
        if (detected == null || detected.isBlank()) {
            detected = clientMime;
        }
        return normalizeMime(detected);
    }

    private String extToMime(String extRaw) {
        String ext = normalizeExtension(extRaw);
        if (ext == null) {
            return Constantes.MIME_APPLICATION_OCTET_STREAM;
        }
        if (Set.of(".png").contains(ext)) return "image/png";
        if (Set.of(".jpg", ".jpeg").contains(ext)) return "image/jpeg";
        if (Set.of(".gif").contains(ext)) return "image/gif";
        if (Set.of(".webp").contains(ext)) return "image/webp";
        if (Set.of(".webm").contains(ext)) return "audio/webm";
        if (Set.of(".ogg", ".opus").contains(ext)) return "audio/ogg";
        if (Set.of(".mp3").contains(ext)) return "audio/mpeg";
        if (Set.of(".wav").contains(ext)) return "audio/wav";
        if (Set.of(".m4a", ".mp4").contains(ext)) return "audio/mp4";
        if (Set.of(".pdf").contains(ext)) return "application/pdf";
        if (Set.of(".txt").contains(ext)) return "text/plain";
        if (Set.of(".zip").contains(ext)) return "application/zip";
        if (Set.of(".doc").contains(ext)) return "application/msword";
        if (Set.of(".docx").contains(ext)) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        return Constantes.MIME_APPLICATION_OCTET_STREAM;
    }

    private void runMalwareScanIfEnabled(byte[] bytes, String extension, UploadAuditContext audit) {
        if (!antivirusEnabled) {
            return;
        }
        Path tmp = null;
        try {
            Path tmpDir = prepareDirectory("tmp-av");
            tmp = tmpDir.resolve(UUID.randomUUID() + normalizeExtension(extension));
            Files.write(tmp, bytes);
            if (antivirusCommand.isBlank()) {
                return;
            }
            Process process = new ProcessBuilder(antivirusCommand, tmp.toAbsolutePath().toString())
                    .redirectErrorStream(true)
                    .start();
            int exit = process.waitFor();
            if (exit != 0) {
                quarantineFile(tmp);
                throwSecurityBlock("malware", "Archivo bloqueado por escaneo antivirus", audit, null, extension, (long) bytes.length);
            }
        } catch (UploadSecurityException ex) {
            throw ex;
        } catch (Exception ex) {
            throwSecurityBlock("malware_scan_error", "No se pudo completar escaneo antivirus", audit, null, extension, (long) bytes.length);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // no-op
                }
            }
        }
    }

    private void quarantineFile(Path tmpPath) {
        if (tmpPath == null) {
            return;
        }
        try {
            Path quarantine = prepareDirectory(quarantineDir);
            Path destination = quarantine.resolve(tmpPath.getFileName().toString());
            Files.move(tmpPath, destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception ex) {
            LOGGER.warn("[SECURITY_BLOCK] motivo=malware_quarantine_error error={}", ex.getClass().getSimpleName());
        }
    }

    private String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit((b & 0xF), 16));
            }
            return sb.toString();
        } catch (Exception ex) {
            return "sha256_error";
        }
    }

    private void throwSecurityBlock(String reason,
                                    String message,
                                    UploadAuditContext audit,
                                    String mime,
                                    String extension,
                                    Long sizeBytes) {
        LOGGER.warn("[SECURITY_BLOCK] motivo={} userId={} ip={} chatId={} messageId={} mime={} ext={} sizeBytes={} fileName={}",
                reason,
                audit.userId(),
                audit.ip(),
                audit.chatId(),
                audit.messageId(),
                mime,
                extension,
                sizeBytes,
                audit.clientFileName());
        throw new UploadSecurityException(Constantes.ERR_UPLOAD_SECURITY_BLOCK, message);
    }

    private void logUploadAudit(String event,
                                UploadAuditContext audit,
                                String mime,
                                long sizeBytes,
                                String sha256,
                                String url,
                                String error) {
        LOGGER.info("[UPLOAD_AUDIT] event={} userId={} ip={} chatId={} messageId={} mime={} sizeBytes={} sha256={} url={} error={}",
                event,
                audit.userId(),
                audit.ip(),
                audit.chatId(),
                audit.messageId(),
                mime,
                sizeBytes,
                sha256,
                url,
                error);
    }

    private UploadAuditContext buildAuditContext(String action, Long chatId, Long messageId, MultipartFile file) {
        HttpServletRequest request = currentRequest();
        String ip = request == null ? "-" : clientIpResolver.resolve(request);
        Long userId;
        try {
            userId = securityUtils.getAuthenticatedUserId();
        } catch (Exception ex) {
            userId = null;
        }
        String clientFileName = safeClientName(file == null ? null : file.getOriginalFilename());
        LOGGER.info("[UPLOAD_AUDIT] event={} userId={} ip={} chatId={} messageId={} fileName={}",
                action,
                userId,
                ip,
                chatId,
                messageId,
                clientFileName);
        return new UploadAuditContext(userId, ip, chatId, messageId, clientFileName);
    }

    private HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletRequestAttributes) {
            return servletRequestAttributes.getRequest();
        }
        return null;
    }

    private boolean isAllowedMime(String mime) {
        if (mime == null || mime.isBlank()) {
            return false;
        }
        return allowedMimeSet.contains(mime.toLowerCase(Locale.ROOT));
    }

    private boolean isAllowedExtension(String ext) {
        String normalized = normalizeExtension(ext);
        if (normalized == null || normalized.isBlank()) {
            return false;
        }
        return allowedExtSet.contains(normalized);
    }

    private Set<String> parseCsvToLowerSet(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> parseExtensionsSet(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(this::normalizeExtension)
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String normalizeExtension(String ext) {
        if (ext == null || ext.isBlank()) {
            return null;
        }
        String trimmed = ext.trim().toLowerCase(Locale.ROOT);
        if (!trimmed.startsWith(".")) {
            trimmed = "." + trimmed;
        }
        if (!trimmed.matches("\\.[a-z0-9]{1,10}")) {
            return null;
        }
        return trimmed;
    }

    private String safeClientName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "unknown";
        }
        String cleaned = originalFilename.replace("\\", "/");
        int slash = cleaned.lastIndexOf('/');
        String base = slash >= 0 ? cleaned.substring(slash + 1) : cleaned;
        base = base.replaceAll("[\\r\\n\\t]", "_").trim();
        if (base.isBlank()) {
            return "unknown";
        }
        if (base.length() > 200) {
            return base.substring(0, 200);
        }
        return base;
    }

    private String extensionFromOriginalName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return null;
        }
        String cleaned = safeClientName(originalFilename);
        int dot = cleaned.lastIndexOf('.');
        if (dot < 0 || dot == cleaned.length() - 1) {
            return null;
        }
        String ext = cleaned.substring(dot).toLowerCase();
        if (!ext.matches("\\.[a-z0-9]{1,10}")) {
            return null;
        }
        return ext;
    }

    private Path prepareDirectory(String subDir) throws IOException {
        Path dir = Paths.get(uploadsRoot, subDir).toAbsolutePath().normalize();
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        return dir;
    }

    private String generateUniqueFileName(String extension) {
        String safeExt = normalizeExtension(extension);
        if (safeExt == null || safeExt.isBlank()) {
            safeExt = ".bin";
        }
        return UUID.randomUUID() + safeExt;
    }

    private String buildPublicUrl(String subDir, String fileName) {
        String baseUrl = uploadsBaseUrl.endsWith("/") ? uploadsBaseUrl : uploadsBaseUrl + "/";
        return baseUrl + subDir + "/" + fileName;
    }

    private String buildDownloadUrl(String storedPublicUrl, Long chatId, Long messageId) {
        String encoded = URLEncoder.encode(storedPublicUrl, StandardCharsets.UTF_8);
        StringBuilder sb = new StringBuilder();
        sb.append(Constantes.API_UPLOADS_ALL).append("/file/download?url=").append(encoded);
        if (chatId != null) {
            sb.append("&chatId=").append(chatId);
        }
        if (messageId != null) {
            sb.append("&messageId=").append(messageId);
        }
        return sb.toString();
    }

    private void validateUploadAccess(Long chatId, Long messageId, UploadAuditContext audit) {
        if (chatId == null) {
            throwSecurityBlock("chat_required", "chatId es obligatorio para subir archivos", audit, null, null, null);
        }
        Long userId = requireAuthenticatedUser(audit);
        assertUserBelongsToChat(chatId, userId, audit);
        if (messageId != null) {
            MensajeEntity mensaje = mensajeRepository.findByIdAndChatId(messageId, chatId).orElse(null);
            if (mensaje == null) {
                throwSecurityBlock("message_chat_mismatch", "messageId no pertenece al chat", audit, null, null, null);
            }
        }
    }

    private void validateDownloadAccess(String requestedUrl, Long chatId, Long messageId, UploadAuditContext audit) {
        if (chatId == null) {
            throwSecurityBlock("chat_required", "chatId es obligatorio para descargar archivos", audit, null, null, null);
        }
        if (messageId == null) {
            throwSecurityBlock("message_required", "messageId es obligatorio para descargar archivos", audit, null, null, null);
        }
        Long userId = requireAuthenticatedUser(audit);
        assertUserBelongsToChat(chatId, userId, audit);

        MensajeEntity mensaje = mensajeRepository.findByIdAndChatId(messageId, chatId).orElse(null);
        if (mensaje == null) {
            throwSecurityBlock("message_chat_mismatch", "messageId no pertenece al chat", audit, null, null, null);
        }

        String linkedUrl = resolveLinkedMediaUrl(mensaje);
        String normalizedRequested = normalizeUploadsUrl(requestedUrl);
        String normalizedLinked = normalizeUploadsUrl(linkedUrl);
        if (normalizedLinked == null || !Objects.equals(normalizedLinked, normalizedRequested)) {
            throwSecurityBlock("message_url_mismatch", "La URL no coincide con el archivo asociado al mensaje", audit, null, null, null);
        }
    }

    private Long requireAuthenticatedUser(UploadAuditContext audit) {
        if (audit == null || audit.userId() == null) {
            throwSecurityBlock("auth_required", "Usuario no autenticado para operacion de archivo", audit, null, null, null);
        }
        return audit.userId();
    }

    private void assertUserBelongsToChat(Long chatId, Long userId, UploadAuditContext audit) {
        Optional<ChatIndividualEntity> individualOpt = chatIndividualRepository.findById(chatId);
        if (individualOpt.isPresent()) {
            ChatIndividualEntity chat = individualOpt.get();
            Long user1 = chat.getUsuario1() == null ? null : chat.getUsuario1().getId();
            Long user2 = chat.getUsuario2() == null ? null : chat.getUsuario2().getId();
            boolean belongs = Objects.equals(user1, userId) || Objects.equals(user2, userId);
            if (!belongs) {
                throwSecurityBlock("chat_forbidden", Constantes.MSG_NO_PERTENECE_CHAT, audit, null, null, null);
            }
            return;
        }

        Optional<ChatGrupalEntity> groupOpt = chatGrupalRepository.findByIdWithUsuarios(chatId);
        if (groupOpt.isPresent()) {
            ChatGrupalEntity chat = groupOpt.get();
            if (!chat.isActivo()) {
                throwSecurityBlock("chat_inactive", Constantes.MSG_CHAT_GRUPAL_NO_ENCONTRADO, audit, null, null, null);
            }
            boolean belongs = chat.getUsuarios() != null
                    && chat.getUsuarios().stream()
                    .filter(Objects::nonNull)
                    .anyMatch(u -> Objects.equals(u.getId(), userId) && u.isActivo());
            if (!belongs) {
                throwSecurityBlock("chat_forbidden", Constantes.MSG_NO_PERTENECE_GRUPO, audit, null, null, null);
            }
            return;
        }

        throwSecurityBlock("chat_missing", "Chat no encontrado", audit, null, null, null);
    }

    private String resolveLinkedMediaUrl(MensajeEntity mensaje) {
        if (mensaje == null) {
            return null;
        }
        if (mensaje.getMediaUrl() != null && !mensaje.getMediaUrl().isBlank()) {
            return mensaje.getMediaUrl().trim();
        }
        String contenido = mensaje.getContenido();
        if (contenido == null || contenido.isBlank()) {
            return null;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(contenido);
            String[] keys = {"fileUrl", "imageUrl", "audioUrl", "url"};
            for (String key : keys) {
                JsonNode node = root == null ? null : root.get(key);
                if (node != null && node.isTextual()) {
                    String value = node.asText();
                    if (value != null && !value.isBlank() && value.startsWith(Constantes.UPLOADS_PREFIX)) {
                        return value.trim();
                    }
                }
            }
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeUploadsUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String normalized = url.trim();
        int queryIdx = normalized.indexOf('?');
        if (queryIdx >= 0) {
            normalized = normalized.substring(0, queryIdx);
        }
        return normalized;
    }

    private Path resolvePublicUrlToPath(String publicUrl, UploadAuditContext audit) {
        if (publicUrl == null || publicUrl.isBlank() || !publicUrl.startsWith(Constantes.UPLOADS_PREFIX)) {
            throwSecurityBlock("download_policy", "URL de descarga invalida", audit, null, null, null);
        }
        String relative = publicUrl.substring(Constantes.UPLOADS_PREFIX.length());
        Path root = Paths.get(uploadsRoot).toAbsolutePath().normalize();
        Path path = root.resolve(relative).normalize();
        if (!path.startsWith(root)) {
            throwSecurityBlock("download_traversal", "Ruta de descarga invalida", audit, null, null, null);
        }
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throwSecurityBlock("download_missing", "Archivo no encontrado", audit, null, null, null);
        }
        return path;
    }

    private String normalizeMime(String mime) {
        if (mime == null || mime.isBlank()) {
            return Constantes.MIME_APPLICATION_OCTET_STREAM;
        }
        return mime.trim().toLowerCase(Locale.ROOT);
    }

    private record UploadAuditContext(Long userId, String ip, Long chatId, Long messageId, String clientFileName) {
    }

    private record StoredFile(String url, String mime, String fileName, Long sizeBytes) {
    }
}
