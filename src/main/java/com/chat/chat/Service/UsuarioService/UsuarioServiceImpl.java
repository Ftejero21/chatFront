package com.chat.chat.Service.UsuarioService;

import com.chat.chat.DTO.UsuarioDTO;
import com.chat.chat.DTO.ActualizarPerfilDTO;
import com.chat.chat.DTO.E2EPrivateKeyBackupDTO;
import com.chat.chat.DTO.E2ERekeyRequestDTO;
import com.chat.chat.DTO.E2EStateDTO;
import com.chat.chat.DTO.GoogleAuthRequestDTO;
import com.chat.chat.DTO.GoogleTokenPayloadDTO;
import com.chat.chat.Entity.E2EPrivateKeyBackupEntity;
import com.chat.chat.Entity.SolicitudDesbaneoEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.EmailNoRegistradoException;
import com.chat.chat.Exceptions.EmailYaExisteException;
import com.chat.chat.Exceptions.E2ERekeyConflictException;
import com.chat.chat.Exceptions.GoogleAuthException;
import com.chat.chat.Exceptions.PasswordIncorrectaException;
import com.chat.chat.Exceptions.SemanticApiException;
import com.chat.chat.Exceptions.UsuarioInactivoException;
import com.chat.chat.Mapper.E2EPrivateKeyBackupMapper;
import com.chat.chat.Repository.E2EPrivateKeyBackupRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Repository.SolicitudDesbaneoRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MappingUtils;
import com.chat.chat.Utils.Utils;
import com.chat.chat.Utils.ExceptionConstants;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.chat.chat.Utils.E2EDiagnosticUtils;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.DTO.DashboardStatsDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import com.chat.chat.DTO.AuthRespuestaDTO;
import com.chat.chat.Security.CustomUserDetailsService;
import com.chat.chat.Security.JwtService;
import com.chat.chat.Service.AuthService.GoogleIdTokenValidatorService;
import com.chat.chat.Service.EmailService.EmailService;
import com.chat.chat.Service.AuthService.PasswordChangeService;
import com.chat.chat.Utils.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static io.micrometer.core.instrument.util.StringEscapeUtils.escapeJson;

@Service
public class UsuarioServiceImpl implements UsuarioService {
    private static final Logger LOGGER = LoggerFactory.getLogger(UsuarioServiceImpl.class);
    private static final int MAX_ENCRYPTED_PRIVATE_KEY_LEN = 65535;
    private static final int MAX_IV_LEN = 1024;
    private static final int MAX_SALT_LEN = 1024;
    private static final int MAX_KDF_LEN = 32;
    private static final int MAX_KDF_HASH_LEN = 32;
    private static final int MAX_PUBLIC_KEY_LEN = 65535;
    private static final int MAX_PUBLIC_KEY_FINGERPRINT_LEN = 256;
    private static final int MIN_KDF_ITERATIONS = 10000;
    private static final int MAX_KDF_ITERATIONS = 10000000;
    private static final int MIN_KEY_LENGTH_BITS = 128;
    private static final int MAX_KEY_LENGTH_BITS = 8192;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ChatRepository chatRepository;

    @Autowired
    private MensajeRepository mensajeRepository;

    @Autowired
    private SolicitudDesbaneoRepository solicitudDesbaneoRepository;

    @Autowired
    private E2EPrivateKeyBackupRepository e2EPrivateKeyBackupRepository;

    @Value("${app.uploads.root:uploads}") // carpeta base
    private String uploadsRoot;

    @Value("${app.uploads.base-url:/uploads}") // prefijo pÃºblico
    private String uploadsBaseUrl;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // repos, encoder, etc. inyectadosâ€¦

    @Autowired
    private JwtService jwtService;
    @Autowired
    private CustomUserDetailsService customUserDetailsService;
    @Autowired
    private SecurityUtils securityUtils;
    @Autowired
    private PasswordChangeService passwordChangeService;
    @Autowired
    private GoogleIdTokenValidatorService googleIdTokenValidatorService;
    @Autowired
    private AdminAuditCrypto adminAuditCrypto;

    @Autowired
    private E2EPrivateKeyBackupMapper e2EPrivateKeyBackupMapper;

    @Override
    public AuthRespuestaDTO crearUsuarioConToken(UsuarioDTO dto) {

        if (usuarioRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new EmailYaExisteException(ExceptionConstants.ERROR_EMAIL_EXISTS);
        }

        // 1) foto: si llega como dataURL, guardamos y sustituimos por URL
        String fotoUrl = null;
        if (dto.getFoto() != null) {
            String f = dto.getFoto();
            if (dto.getFoto() != null && dto.getFoto().startsWith(Constantes.DATA_IMAGE_PREFIX)) {
                String url = Utils.saveDataUrlToUploads(dto.getFoto(), Constantes.DIR_AVATARS, uploadsRoot, uploadsBaseUrl);
                fotoUrl = url;
                dto.setFoto(url); // guarda URL pÃºblica en DTO
            } else if (f.startsWith(Constantes.UPLOADS_PREFIX) || f.startsWith(Constantes.HTTP_PREFIX)) {
                fotoUrl = f; // ya es una URL vÃ¡lida
            }
            // si quieres, limpia dto para no guardar base64 por error
            dto.setFoto(fotoUrl);
        }

        // 2) mapear y ajustar campos
        UsuarioEntity entity = MappingUtils.usuarioDtoAEntity(dto);
        entity.setFechaCreacion(LocalDateTime.now());
        entity.setActivo(true);
        entity.setRoles(Collections.singleton(Constantes.USUARIO));
        if (hasPublicKey(entity.getPublicKey())) {
            entity.setPublicKeyUpdatedAt(LocalDateTime.now());
        }

        String encryptedPassword = passwordEncoder.encode(dto.getPassword());
        entity.setPassword(encryptedPassword);

        // setear fotoUrl en la entidad (si procede)
        if (fotoUrl != null) {
            entity.setFotoUrl(fotoUrl);
        } else if (entity.getFotoUrl() == null) {
            // deja null si no hay foto
            entity.setFotoUrl(null);
        }

        UsuarioEntity saved = usuarioRepository.save(entity);
        UsuarioDTO savedDto = MappingUtils.usuarioEntityADto(saved);

        // Generar Token
        UserDetails userDetails = customUserDetailsService.loadUserByUsername(saved.getEmail());
        String jwtToken = jwtService.generateToken(userDetails);

        return new AuthRespuestaDTO(jwtToken, savedDto, adminAuditCrypto.getAuditPublicKeySpkiBase64());
    }

    // Mantenemos este por compatibilidad interna si se necesita (aunque el de
    // arriba es el del endpoint ahora)
    @Override
    public UsuarioDTO crearUsuario(UsuarioDTO dto) {
        return crearUsuarioConToken(dto).getUsuario();
    }

    @Override
    public List<UsuarioDTO> listarUsuariosActivos() {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        List<UsuarioDTO> list = usuarioRepository.findByActivoTrueAndIdNot(authenticatedUserId).stream()
                .filter(u -> !isAdminUser(u.getRoles()))
                .map(MappingUtils::usuarioEntityADto)
                .collect(Collectors.toList());

        // ðŸ”„ Convertir /uploads/... a dataURL Base64 (igual que getById)
        for (UsuarioDTO dto : list) {
            String foto = dto.getFoto();
            if (foto != null && foto.startsWith(Constantes.UPLOADS_PREFIX)) {
                String dataUrl = Utils.toDataUrlFromUrl(foto, uploadsRoot);
                if (dataUrl != null) {
                    dto.setFoto(dataUrl);
                } // si devuelve null, dejamos la URL tal cual
            }
        }

        return list;
    }

    private boolean isAdminUser(Set<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        return roles.stream().anyMatch(role -> Constantes.ADMIN.equalsIgnoreCase(role) || Constantes.ROLE_ADMIN.equalsIgnoreCase(role));
    }

    private void validateSelfOrAdmin(Long targetUserId) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        if (authenticatedUserId != null && targetUserId != null
                && authenticatedUserId.longValue() == targetUserId.longValue()) {
            return;
        }
        boolean requesterIsAdmin = securityUtils.hasRole(Constantes.ADMIN)
                || securityUtils.hasRole(Constantes.ROLE_ADMIN)
                || usuarioRepository.findById(authenticatedUserId)
                .map(u -> isAdminUser(u.getRoles()))
                .orElse(false);
        if (!requesterIsAdmin) {
            throw new AccessDeniedException(ExceptionConstants.ERROR_NOT_AUTHORIZED_PUBLIC_KEY);
        }
    }

    private void validateSelfOrAdminForBackup(Long targetUserId) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        boolean self = authenticatedUserId != null && targetUserId != null
                && authenticatedUserId.longValue() == targetUserId.longValue();
        if (self) {
            return;
        }
        boolean admin = securityUtils.hasRole(Constantes.ADMIN)
                || securityUtils.hasRole(Constantes.ROLE_ADMIN)
                || usuarioRepository.findById(authenticatedUserId)
                .map(u -> isAdminUser(u.getRoles()))
                .orElse(false);
        if (admin) {
            return;
        }
        throw semanticError(HttpStatus.FORBIDDEN, Constantes.ERR_NO_AUTORIZADO, "No autorizado para operar este backup E2E");
    }

    private void validateUserExists(Long userId) {
        boolean exists = usuarioRepository.findFreshById(userId)
                .or(() -> usuarioRepository.findById(userId))
                .isPresent();
        if (!exists) {
            throw semanticError(HttpStatus.NOT_FOUND, Constantes.ERR_NO_ENCONTRADO, Constantes.MSG_USUARIO_NO_ENCONTRADO);
        }
    }

    private SemanticApiException semanticError(HttpStatus status, String code, String message) {
        String traceId = Optional.ofNullable(E2EDiagnosticUtils.currentTraceId()).orElse(E2EDiagnosticUtils.newTraceId());
        return new SemanticApiException(status, code, message, traceId);
    }

    private E2EStateDTO toE2EState(UsuarioEntity usuario) {
        E2EStateDTO state = new E2EStateDTO();
        boolean hasKey = hasPublicKey(usuario == null ? null : usuario.getPublicKey());
        state.setHasPublicKey(hasKey);
        state.setPublicKeyFingerprint(E2EDiagnosticUtils.fingerprint12(usuario == null ? null : usuario.getPublicKey()));
        LocalDateTime updatedAt = null;
        if (usuario != null) {
            updatedAt = usuario.getPublicKeyUpdatedAt() != null ? usuario.getPublicKeyUpdatedAt() : usuario.getFechaCreacion();
        }
        state.setUpdatedAt(updatedAt);
        return state;
    }

    private String normalizeFingerprint(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean hasPublicKey(String key) {
        return key != null && !key.isBlank();
    }

    private String requireNonBlankWithinLimit(String value, String fieldName, int maxLen) {
        if (value == null || value.isBlank()) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID, fieldName + " es obligatorio");
        }
        if (value.length() > maxLen) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID,
                    fieldName + " supera longitud maxima permitida");
        }
        return value;
    }

    private int requireIntRange(Integer value, String fieldName, int min, int max) {
        if (value == null) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID, fieldName + " es obligatorio");
        }
        if (value < min || value > max) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID,
                    fieldName + " fuera de rango permitido");
        }
        return value;
    }

    private void validateBackupPayload(E2EPrivateKeyBackupDTO request) {
        if (request == null) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID, "Body requerido");
        }

        String kdf = requireNonBlankWithinLimit(request.getKdf(), "kdf", MAX_KDF_LEN).trim();
        if (!"PBKDF2".equalsIgnoreCase(kdf)) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID, "kdf debe ser PBKDF2");
        }

        String kdfHash = requireNonBlankWithinLimit(request.getKdfHash(), "kdfHash", MAX_KDF_HASH_LEN).trim();
        if (!"SHA-256".equalsIgnoreCase(kdfHash)) {
            throw semanticError(HttpStatus.BAD_REQUEST, Constantes.ERR_E2E_BACKUP_INVALID, "kdfHash debe ser SHA-256");
        }

        requireNonBlankWithinLimit(request.getEncryptedPrivateKey(), "encryptedPrivateKey", MAX_ENCRYPTED_PRIVATE_KEY_LEN);
        requireNonBlankWithinLimit(request.getIv(), "iv", MAX_IV_LEN);
        requireNonBlankWithinLimit(request.getSalt(), "salt", MAX_SALT_LEN);
        requireNonBlankWithinLimit(request.getPublicKey(), "publicKey", MAX_PUBLIC_KEY_LEN);
        requireNonBlankWithinLimit(request.getPublicKeyFingerprint(), "publicKeyFingerprint", MAX_PUBLIC_KEY_FINGERPRINT_LEN);
        requireIntRange(request.getKdfIterations(), "kdfIterations", MIN_KDF_ITERATIONS, MAX_KDF_ITERATIONS);
        requireIntRange(request.getKeyLengthBits(), "keyLengthBits", MIN_KEY_LENGTH_BITS, MAX_KEY_LENGTH_BITS);
    }

    @Override
    public AuthRespuestaDTO autenticarConGoogle(GoogleAuthRequestDTO request) {
        return autenticarConGoogle(null, request);
    }

    @Override
    public AuthRespuestaDTO autenticarConGoogle(String modeFromPath, GoogleAuthRequestDTO request) {
        validateGoogleProvider(request);
        String mode = resolveGoogleMode(modeFromPath, request == null ? null : request.getMode());
        String idToken = resolveGoogleIdToken(request);
        GoogleTokenPayloadDTO payload = googleIdTokenValidatorService.validarYExtraer(idToken);

        if (Constantes.GOOGLE_MODE_LOGIN.equals(mode)) {
            UsuarioEntity usuario = usuarioRepository.findByEmail(payload.getEmail())
                    .orElseThrow(() -> new GoogleAuthException(
                            HttpStatus.NOT_FOUND,
                            Constantes.ERR_GOOGLE_USUARIO_NO_REGISTRADO,
                            "No existe usuario registrado con ese email para login con Google"));
            if (!usuario.isActivo()) {
                throw new UsuarioInactivoException(Constantes.MSG_CUENTA_INHABILITADA);
            }
            return buildAuthResponseFromUsuario(usuario);
        }

        if (usuarioRepository.findByEmail(payload.getEmail()).isPresent()) {
            throw new EmailYaExisteException(ExceptionConstants.ERROR_EMAIL_EXISTS);
        }

        UsuarioDTO usuarioNuevo = new UsuarioDTO();
        usuarioNuevo.setEmail(payload.getEmail());
        usuarioNuevo.setNombre(payload.getNombre());
        usuarioNuevo.setApellido(payload.getApellido());
        usuarioNuevo.setFoto(payload.getFoto());
        usuarioNuevo.setPassword(UUID.randomUUID().toString());
        return crearUsuarioConToken(usuarioNuevo);
    }

    private void validateGoogleProvider(GoogleAuthRequestDTO request) {
        String provider = request == null ? null : request.getProvider();
        if (provider == null || provider.isBlank()
                || !Constantes.GOOGLE_PROVIDER.equalsIgnoreCase(provider.trim())) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_PROVIDER_INVALIDO,
                    "provider debe ser GOOGLE");
        }
    }

    private String resolveGoogleMode(String modeFromPath, String modeFromBody) {
        String pathMode = normalizeMode(modeFromPath);
        String bodyMode = normalizeMode(modeFromBody);

        if (pathMode != null && bodyMode != null && !pathMode.equals(bodyMode)) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_MODE_INVALIDO,
                    "mode en path y body no coinciden");
        }

        String mode = pathMode != null ? pathMode : bodyMode;
        if (!Constantes.GOOGLE_MODE_LOGIN.equals(mode) && !Constantes.GOOGLE_MODE_REGISTER.equals(mode)) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_MODE_INVALIDO,
                    "mode debe ser login o register");
        }
        return mode;
    }

    private String normalizeMode(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String resolveGoogleIdToken(GoogleAuthRequestDTO request) {
        if (request == null) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_TOKEN_INVALIDO,
                    "Body requerido para autenticacion Google");
        }

        String token = request.getIdToken();
        if (token == null || token.isBlank()) {
            token = request.getCredential();
        }
        if (token == null || token.isBlank()) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_TOKEN_INVALIDO,
                    "idToken o credential es obligatorio");
        }
        return token.trim();
    }

    // Nuevo mÃ©todo login que devuelve Token
    @Override
    public AuthRespuestaDTO loginConToken(String email, String password) {
        UsuarioEntity usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(EmailNoRegistradoException::new);

        if (!usuario.isActivo()) {
            throw new UsuarioInactivoException(Constantes.MSG_CUENTA_INHABILITADA);
        }

        if (!passwordEncoder.matches(password, usuario.getPassword())) {
            throw new PasswordIncorrectaException();
        }

        return buildAuthResponseFromUsuario(usuario);
    }

    private AuthRespuestaDTO buildAuthResponseFromUsuario(UsuarioEntity usuario) {
        UsuarioDTO dto = MappingUtils.usuarioEntityADto(usuario);
        if (dto.getFoto() != null && dto.getFoto().startsWith(Constantes.UPLOADS_PREFIX)) {
            dto.setFoto(Utils.toDataUrlFromUrl(dto.getFoto(), uploadsRoot));
        }

        UserDetails userDetails = customUserDetailsService.loadUserByUsername(usuario.getEmail());
        String jwtToken = jwtService.generateToken(userDetails);
        return new AuthRespuestaDTO(jwtToken, dto, adminAuditCrypto.getAuditPublicKeySpkiBase64());
    }

    @Override
    public void updatePublicKey(Long id, String publicKey) {
        if (!hasPublicKey(publicKey)) {
            throw new IllegalArgumentException("publicKey es obligatoria");
        }
        UsuarioEntity usuario = usuarioRepository.findFreshById(id)
                .or(() -> usuarioRepository.findById(id))
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
        // Solo el propio usuario autenticado deberÃ­a poder actualizar su propia llave
        if (!usuario.getId().equals(securityUtils.getAuthenticatedUserId())) {
            throw new RuntimeException(ExceptionConstants.ERROR_NOT_AUTHORIZED_PUBLIC_KEY);
        }
        String oldFp = E2EDiagnosticUtils.fingerprint12(usuario.getPublicKey());
        String newFp = E2EDiagnosticUtils.fingerprint12(publicKey);
        boolean replacingExistingDifferentKey = hasPublicKey(usuario.getPublicKey()) && !Objects.equals(oldFp, newFp);
        if (replacingExistingDifferentKey) {
            throw new E2ERekeyConflictException(
                    "Ya existe una publicKey distinta. Usa /api/usuarios/{id}/e2e/rekey para rotarla de forma segura.");
        }
        usuario.setPublicKey(publicKey);
        if (!Objects.equals(oldFp, newFp) || usuario.getPublicKeyUpdatedAt() == null) {
            usuario.setPublicKeyUpdatedAt(LocalDateTime.now());
        }
        usuarioRepository.save(usuario);
        LOGGER.info("[E2E_DIAG] stage=PUBLIC_KEY_UPDATE ts={} userId={} oldKeyFp={} newKeyFp={} changed={}",
                Instant.now(), usuario.getId(), oldFp, newFp, !oldFp.equals(newFp));
    }

    @Override
    public E2EStateDTO getE2EState(Long id) {
        validateSelfOrAdmin(id);
        UsuarioEntity usuario = usuarioRepository.findFreshById(id)
                .or(() -> usuarioRepository.findById(id))
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
        return toE2EState(usuario);
    }

    @Override
    @Transactional
    public E2EStateDTO rekeyE2E(Long id, E2ERekeyRequestDTO request) {
        validateSelfOrAdmin(id);
        if (request == null || !hasPublicKey(request.getNewPublicKey())) {
            throw new IllegalArgumentException("newPublicKey es obligatoria");
        }
        if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            throw new IllegalArgumentException("currentPassword es obligatoria");
        }

        Long requesterId = securityUtils.getAuthenticatedUserId();
        UsuarioEntity requester = usuarioRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
        if (!passwordEncoder.matches(request.getCurrentPassword(), requester.getPassword())) {
            throw new PasswordIncorrectaException();
        }

        UsuarioEntity usuario = usuarioRepository.findFreshById(id)
                .or(() -> usuarioRepository.findById(id))
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));

        String oldFp = E2EDiagnosticUtils.fingerprint12(usuario.getPublicKey());
        String newFp = E2EDiagnosticUtils.fingerprint12(request.getNewPublicKey());
        String expectedOldFingerprint = normalizeFingerprint(request.getExpectedOldFingerprint());
        if (expectedOldFingerprint != null && !Objects.equals(expectedOldFingerprint, oldFp)) {
            throw new E2ERekeyConflictException("expectedOldFingerprint no coincide con el estado actual");
        }

        usuario.setPublicKey(request.getNewPublicKey());
        usuario.setPublicKeyUpdatedAt(LocalDateTime.now());
        usuarioRepository.save(usuario);

        String traceId = Optional.ofNullable(E2EDiagnosticUtils.currentTraceId()).orElse(E2EDiagnosticUtils.newTraceId());
        MDC.put(E2EDiagnosticUtils.TRACE_ID_MDC_KEY, traceId);
        try {
            LOGGER.info("[E2E_DIAG] stage=E2E_REKEY ts={} traceId={} userId={} oldFp={} newFp={}",
                    Instant.now(), traceId, id, oldFp, newFp);
        } finally {
            MDC.remove(E2EDiagnosticUtils.TRACE_ID_MDC_KEY);
        }

        return toE2EState(usuario);
    }

    @Override
    @Transactional
    public void upsertE2EPrivateKeyBackup(Long userId, E2EPrivateKeyBackupDTO request) {
        validateSelfOrAdminForBackup(userId);
        validateUserExists(userId);
        validateBackupPayload(request);

        E2EPrivateKeyBackupEntity existing = e2EPrivateKeyBackupRepository.findByUserId(userId).orElse(null);
        E2EPrivateKeyBackupEntity entity = e2EPrivateKeyBackupMapper.toEntity(
                userId,
                request,
                existing,
                LocalDateTime.now());
        e2EPrivateKeyBackupRepository.save(entity);

        String traceId = Optional.ofNullable(E2EDiagnosticUtils.currentTraceId()).orElse(E2EDiagnosticUtils.newTraceId());
        LOGGER.info("[E2E_BACKUP] stage=UPSERT ts={} traceId={} userId={} existed={} keyFp={} encryptedLen={}",
                Instant.now(),
                traceId,
                userId,
                existing != null,
                E2EDiagnosticUtils.fingerprint12(entity.getPublicKeyFingerprint()),
                entity.getEncryptedPrivateKey() == null ? 0 : entity.getEncryptedPrivateKey().length());
    }

    @Override
    public E2EPrivateKeyBackupDTO getE2EPrivateKeyBackup(Long userId) {
        validateSelfOrAdminForBackup(userId);
        validateUserExists(userId);

        E2EPrivateKeyBackupEntity entity = e2EPrivateKeyBackupRepository.findByUserId(userId)
                .orElseThrow(() -> semanticError(
                        HttpStatus.NOT_FOUND,
                        Constantes.ERR_E2E_BACKUP_NOT_FOUND,
                        "No existe backup E2E para el usuario"));

        return e2EPrivateKeyBackupMapper.toDto(entity);
    }

    @Override
    public UsuarioDTO login(String email, String password) {
        return loginConToken(email, password).getUsuario();
    }

    @Override
    public UsuarioDTO getById(Long id) {
        UsuarioEntity u = usuarioRepository.findFreshById(id)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
        LOGGER.info("[E2E_DIAG] stage=USER_GET_BY_ID ts={} userId={} publicKeyFp={} publicKeyLen={}",
                Instant.now(), id, E2EDiagnosticUtils.fingerprint12(u.getPublicKey()), u.getPublicKey() == null ? 0 : u.getPublicKey().length());
        UsuarioDTO dto = MappingUtils.usuarioEntityADto(u);
        // ðŸ‘‰ Si la foto es una URL pÃºblica (/uploads/...), la convertimos a Base64 para
        // el front
        if (dto.getFoto() != null && dto.getFoto().startsWith(Constantes.UPLOADS_PREFIX)) {
            dto.setFoto(Utils.toDataUrlFromUrl(dto.getFoto(), uploadsRoot));
        }
        return dto;
    }

    @Override
    public List<UsuarioDTO> buscarPorNombre(String q) {
        if (q == null || q.trim().isEmpty()) {
            return Collections.emptyList();
        }
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        String query = q.trim();

        List<UsuarioDTO> list = usuarioRepository.searchActivosByNombre(query)
                .stream()
                .filter(u -> !u.getId().equals(authenticatedUserId))
                .map(MappingUtils::usuarioEntityADto)
                .collect(Collectors.toList());

        // Convertir /uploads/... a dataURL Base64 (igual que en otros mÃ©todos)
        for (UsuarioDTO dto : list) {
            String foto = dto.getFoto();
            if (foto != null && foto.startsWith(Constantes.UPLOADS_PREFIX)) {
                String dataUrl = Utils.toDataUrlFromUrl(foto, uploadsRoot);
                if (dataUrl != null) {
                    dto.setFoto(dataUrl);
                }
            }
        }

        return list;
    }

    @Override
    @Transactional
    public void bloquearUsuario(Long bloqueadoId) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        System.out.println(Constantes.LOG_BLOCK_ATTEMPT + authenticatedUserId + " bloqueado=" + bloqueadoId);
        if (authenticatedUserId.equals(bloqueadoId)) {
            throw new RuntimeException(ExceptionConstants.ERROR_CANT_BLOCK_SELF);
        }

        UsuarioEntity user = usuarioRepository.findById(authenticatedUserId).orElseThrow();
        UsuarioEntity blocked = usuarioRepository.findById(bloqueadoId).orElseThrow();

        if (user.getBloqueados().add(blocked)) {
            System.out.println(Constantes.LOG_BLOCK_SUCCESS);
            usuarioRepository.save(user);
            // Notify the blocked user via STOMP that their status changed
            messagingTemplate.convertAndSend(Constantes.WS_TOPIC_USER_BLOQUEOS_PREFIX + bloqueadoId + Constantes.WS_TOPIC_USER_BLOQUEOS_SUFFIX,
                    String.format(Constantes.WS_BLOCK_STATUS_PAYLOAD_TEMPLATE, authenticatedUserId, Constantes.WS_TYPE_BLOCKED));
        } else {
            System.out.println(Constantes.LOG_BLOCK_ALREADY);
        }
    }

    @Override
    @Transactional
    public void desbloquearUsuario(Long bloqueadoId) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();

        UsuarioEntity user = usuarioRepository.findById(authenticatedUserId).orElseThrow();
        UsuarioEntity blocked = usuarioRepository.findById(bloqueadoId).orElseThrow();

        if (user.getBloqueados().remove(blocked)) {
            usuarioRepository.save(user);
            // Notify the unblocked user via STOMP
            messagingTemplate.convertAndSend(Constantes.WS_TOPIC_USER_BLOQUEOS_PREFIX + bloqueadoId + Constantes.WS_TOPIC_USER_BLOQUEOS_SUFFIX,
                    String.format(Constantes.WS_BLOCK_STATUS_PAYLOAD_TEMPLATE, authenticatedUserId, Constantes.WS_TYPE_UNBLOCKED));
        }
    }

    @Override
    public boolean existePorEmail(String email) {
        return usuarioRepository.findByEmail(email).isPresent();
    }

    @Override
    @Transactional
    public void actualizarPasswordPorEmail(String email, String newPassword) {
        UsuarioEntity usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(EmailNoRegistradoException::new);
        String encryptedPassword = passwordEncoder.encode(newPassword);
        usuario.setPassword(encryptedPassword);
        usuarioRepository.save(usuario);
    }

    @Override
    public DashboardStatsDTO getDashboardStats() {
        return getDashboardStats(null);
    }

    @Override
    public DashboardStatsDTO getDashboardStats(String tz) {
        ZoneId queryZone = resolveZoneId(tz);
        ZoneId serverZone = ZoneId.systemDefault();

        ZonedDateTime nowInQueryZone = ZonedDateTime.now(queryZone);
        ZonedDateTime startOfTodayInQueryZone = nowInQueryZone.toLocalDate().atStartOfDay(queryZone);
        ZonedDateTime startOfYesterdayInQueryZone = startOfTodayInQueryZone.minusDays(1);
        ZonedDateTime endOfTodayInQueryZone = startOfTodayInQueryZone.plusDays(1);

        LocalDateTime inicioDia = startOfTodayInQueryZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime finDia = endOfTodayInQueryZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime inicioAyer = startOfYesterdayInQueryZone.withZoneSameInstant(serverZone).toLocalDateTime();

        long totalUsuarios = usuarioRepository.count();
        long usuariosHoy = usuarioRepository.countUsuariosRegistradosEntreFechas(inicioDia, finDia);
        long usuariosAyer = usuarioRepository.countUsuariosRegistradosEntreFechas(inicioAyer, inicioDia);
        double porcentajeUsuariosHoy = calcularPorcentajeHoyVsAyer(usuariosHoy, usuariosAyer);

        long chatsActivos = chatRepository.count();
        long chatsCreadosHoy = chatRepository.countChatsEntreFechas(inicioDia, finDia);
        long chatsAyer = chatRepository.countChatsEntreFechas(inicioAyer, inicioDia);
        double porcentajeChatsHoy = calcularPorcentajeHoyVsAyer(chatsCreadosHoy, chatsAyer);

        long reportesDiariosHoy = contarReportantesUnicos(inicioDia, finDia);
        long reportesAyer = contarReportantesUnicos(inicioAyer, inicioDia);
        double porcentajeReportesHoy = calcularPorcentajeHoyVsAyer(reportesDiariosHoy, reportesAyer);

        long mensajesHoy = mensajeRepository.countMensajesEntreFechas(inicioDia, finDia);
        long mensajesAyer = mensajeRepository.countMensajesEntreFechas(inicioAyer, inicioDia);
        double porcentajeMensajesHoy = calcularPorcentajeHoyVsAyer(mensajesHoy, mensajesAyer);

        DashboardStatsDTO dto = new DashboardStatsDTO();
        dto.setTotalUsuarios(totalUsuarios);
        dto.setPorcentajeUsuarios(porcentajeUsuariosHoy);
        dto.setPorcentajeUsuariosHoy(porcentajeUsuariosHoy);

        dto.setChatsActivos(chatsActivos);
        dto.setChatsCreadosHoy(chatsCreadosHoy);
        dto.setPorcentajeChats(porcentajeChatsHoy);
        dto.setPorcentajeChatsHoy(porcentajeChatsHoy);

        // Compatibilidad: mantener reportes y porcentajeReportes con la misma regla hoy vs ayer.
        dto.setReportes(reportesDiariosHoy);
        dto.setReportesDiariosHoy(reportesDiariosHoy);
        dto.setPorcentajeReportes(porcentajeReportesHoy);
        dto.setPorcentajeReportesHoy(porcentajeReportesHoy);

        dto.setMensajesHoy(mensajesHoy);
        dto.setPorcentajeMensajes(porcentajeMensajesHoy);
        dto.setPorcentajeMensajesHoy(porcentajeMensajesHoy);
        return dto;
    }

    private long contarReportantesUnicos(LocalDateTime from, LocalDateTime to) {
        List<SolicitudDesbaneoEntity> rows = solicitudDesbaneoRepository
                .findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to);
        HashSet<String> uniqueReporters = new HashSet<>();
        for (SolicitudDesbaneoEntity row : rows) {
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
        return uniqueReporters.size();
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

    private String normalizeEmailNullable(String emailRaw) {
        if (emailRaw == null) {
            return null;
        }
        String normalized = emailRaw.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private double calcularPorcentajeHoyVsAyer(long hoy, long ayer) {
        double value;
        if (ayer > 0) {
            value = ((double) (hoy - ayer) / (double) ayer) * 100.0;
        } else if (hoy == 0) {
            value = 0.0;
        } else {
            value = 100.0;
        }

        double rounded = Math.round(value * 10.0) / 10.0;
        return rounded == -0.0d ? 0.0d : rounded;
    }

    @Override
    public Page<UsuarioDTO> listarRecientes(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, size);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<UsuarioEntity> entidades = usuarioRepository.findRecientesSinRol(pageable, Constantes.ADMIN);
        return entidades.map(MappingUtils::usuarioEntityADto);
    }

    @Override
    @Transactional
    public UsuarioDTO actualizarPerfil(ActualizarPerfilDTO dto) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));

        if (dto.getNombre() != null && !dto.getNombre().isBlank()) {
            usuario.setNombre(dto.getNombre().trim());
        }
        if (dto.getApellido() != null && !dto.getApellido().isBlank()) {
            usuario.setApellido(dto.getApellido().trim());
        }
        if (dto.getFoto() != null) {
            String f = dto.getFoto().trim();
            if (!f.isEmpty()) {
                if (f.startsWith(Constantes.DATA_IMAGE_PREFIX)) {
                    String url = Utils.saveDataUrlToUploads(f, Constantes.DIR_AVATARS, uploadsRoot, uploadsBaseUrl);
                    usuario.setFotoUrl(url);
                } else if (f.startsWith(Constantes.UPLOADS_PREFIX) || f.startsWith(Constantes.HTTP_PREFIX)) {
                    usuario.setFotoUrl(f);
                }
            }
        }

        UsuarioEntity saved = usuarioRepository.save(usuario);
        UsuarioDTO out = MappingUtils.usuarioEntityADto(saved);
        if (out.getFoto() != null && out.getFoto().startsWith(Constantes.UPLOADS_PREFIX)) {
            out.setFoto(Utils.toDataUrlFromUrl(out.getFoto(), uploadsRoot));
        }
        return out;
    }

    @Override
    public void solicitarCodigoCambioPassword(String currentPassword, String newPassword) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("La contrase\u00f1a actual es obligatoria.");
        }
        if (!passwordEncoder.matches(currentPassword, usuario.getPassword())) {
            throw new PasswordIncorrectaException("La contrase\u00f1a actual es incorrecta.");
        }
        if (newPassword != null && !newPassword.isBlank()
                && passwordEncoder.matches(newPassword, usuario.getPassword())) {
            throw new IllegalArgumentException("La nueva contrase\u00f1a no puede ser igual a la actual.");
        }
        passwordChangeService.generateAndSendChangeCode(usuario.getEmail(), usuario.getNombre());
    }

    @Override
    @Transactional
    public void cambiarPasswordConCodigo(String code, String newPassword) {
        Long authenticatedUserId = securityUtils.getAuthenticatedUserId();
        UsuarioEntity usuario = usuarioRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_NO_ENCONTRADO));

        if (code == null || code.isBlank() || newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException(Constantes.MSG_FALTAN_DATOS_REQUERIDOS);
        }

        boolean isValid = passwordChangeService.isCodeValid(usuario.getEmail(), code);
        if (!isValid) {
            throw new IllegalArgumentException(Constantes.MSG_CODIGO_INVALIDO_O_EXPIRADO);
        }

        if (passwordEncoder.matches(newPassword, usuario.getPassword())) {
            throw new IllegalArgumentException("La nueva contrase\u00f1a no puede ser igual a la actual.");
        }

        String encryptedPassword = passwordEncoder.encode(newPassword);
        usuario.setPassword(encryptedPassword);
        usuarioRepository.save(usuario);
        passwordChangeService.invalidateCode(usuario.getEmail());
    }

    @Override
    @Transactional
    public void banearUsuario(Long id, String motivo) {
        UsuarioEntity bloqueado = usuarioRepository.findById(id).orElseThrow();

        // Motivo por defecto si viene null o vacÃ­o
        String motivoFinal = (motivo == null || motivo.trim().isEmpty())
                ? Constantes.BAN_MOTIVO_DEFAULT
                : motivo.trim();

        bloqueado.setActivo(false);
        usuarioRepository.save(bloqueado);

        // 1. WebSocket con el motivo final
        messagingTemplate.convertAndSendToUser(
                bloqueado.getEmail(),
                Constantes.WS_QUEUE_BANEOS,
                String.format(Constantes.WS_BAN_PAYLOAD_TEMPLATE, escapeJson(motivoFinal))
        );

        // 2. Enviar Email con el motivo final
        Map<String, String> vars = new HashMap<>();
        vars.put(Constantes.EMAIL_VAR_NOMBRE, bloqueado.getNombre());
        vars.put(Constantes.EMAIL_VAR_MOTIVO, motivoFinal);

        emailService.sendHtmlEmail(
                bloqueado.getEmail(),
                Constantes.EMAIL_SUBJECT_BAN,
                Constantes.EMAIL_TEMPLATE_BAN,
                vars
        );
    }

    @Override
    @Transactional
    public void desbanearAdministrativamente(Long id) {
        desbanearAdministrativamente(id, null);
    }

    @Override
    @Transactional
    public void desbanearAdministrativamente(Long id, String motivo) {
        UsuarioEntity vetado = usuarioRepository.findById(id).orElseThrow();
        String motivoFinal = (motivo == null || motivo.trim().isEmpty())
                ? Constantes.UNBAN_MOTIVO_DEFAULT
                : motivo.trim();

        vetado.setActivo(true);
        usuarioRepository.save(vetado);

        // 3. Enviar Email de Desbaneo
        Map<String, String> vars = new HashMap<>();
        vars.put(Constantes.EMAIL_VAR_NOMBRE, vetado.getNombre());
        vars.put(Constantes.EMAIL_VAR_MOTIVO, motivoFinal);

        emailService.sendHtmlEmail(
                vetado.getEmail(),
                Constantes.EMAIL_SUBJECT_UNBAN,
                Constantes.EMAIL_TEMPLATE_UNBAN,
                vars);
    }
}

