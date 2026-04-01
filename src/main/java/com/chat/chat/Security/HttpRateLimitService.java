package com.chat.chat.Security;

import com.chat.chat.Exceptions.TooManyRequestsException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;

@Service
public class HttpRateLimitService {

    private static final int LOGIN_LIMIT = 8;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(10);

    private static final int RECOVERY_REQUEST_LIMIT = 5;
    private static final Duration RECOVERY_REQUEST_WINDOW = Duration.ofMinutes(30);

    private static final int RECOVERY_VERIFY_LIMIT = 8;
    private static final Duration RECOVERY_VERIFY_WINDOW = Duration.ofMinutes(30);

    private static final int UNBAN_APPEAL_LIMIT = 3;
    private static final Duration UNBAN_APPEAL_WINDOW = Duration.ofHours(24);

    private static final int ADMIN_HTTP_LIMIT = 180;
    private static final Duration ADMIN_HTTP_WINDOW = Duration.ofMinutes(1);
    private static final int UPLOAD_LIMIT = 40;
    private static final Duration UPLOAD_WINDOW = Duration.ofMinutes(5);
    private static final int E2E_BACKUP_PUT_LIMIT = 15;
    private static final Duration E2E_BACKUP_PUT_WINDOW = Duration.ofMinutes(5);
    private static final int E2E_BACKUP_GET_LIMIT = 60;
    private static final Duration E2E_BACKUP_GET_WINDOW = Duration.ofMinutes(1);

    private final InMemoryRateLimiterService limiter;
    private final ClientIpResolver clientIpResolver;

    public HttpRateLimitService(InMemoryRateLimiterService limiter, ClientIpResolver clientIpResolver) {
        this.limiter = limiter;
        this.clientIpResolver = clientIpResolver;
    }

    public void checkLogin(HttpServletRequest request, String email) {
        String ip = clientIpResolver.resolve(request);
        String identity = normalizeIdentity(email);
        String key = "http:login:" + ip + ":" + identity;
        enforce(key, LOGIN_LIMIT, LOGIN_WINDOW, "Demasiados intentos de login. Intenta mas tarde.");
    }

    public void checkPasswordRecoveryRequest(HttpServletRequest request, String email) {
        String ip = clientIpResolver.resolve(request);
        String identity = normalizeIdentity(email);
        String key = "http:recovery:request:" + ip + ":" + identity;
        enforce(key, RECOVERY_REQUEST_LIMIT, RECOVERY_REQUEST_WINDOW,
                "Demasiadas solicitudes de recuperacion. Intenta mas tarde.");
    }

    public void checkPasswordRecoveryVerify(HttpServletRequest request, String email) {
        String ip = clientIpResolver.resolve(request);
        String identity = normalizeIdentity(email);
        String key = "http:recovery:verify:" + ip + ":" + identity;
        enforce(key, RECOVERY_VERIFY_LIMIT, RECOVERY_VERIFY_WINDOW,
                "Demasiados intentos de verificacion de codigo. Intenta mas tarde.");
    }

    public void checkUnbanAppeal(HttpServletRequest request, String email) {
        String ip = clientIpResolver.resolve(request);
        String identity = normalizeIdentity(email);
        String key = "http:unban-appeal:" + ip + ":" + identity;
        enforce(key, UNBAN_APPEAL_LIMIT, UNBAN_APPEAL_WINDOW,
                "Demasiadas solicitudes de desbaneo para este origen. Intenta mas tarde.");
    }

    public void checkAdminEndpoint(HttpServletRequest request, String endpointKey) {
        String ip = clientIpResolver.resolve(request);
        String userKey = authenticatedUserKey();
        String key = "http:admin:" + endpointKey + ":" + ip + ":" + userKey;
        enforce(key, ADMIN_HTTP_LIMIT, ADMIN_HTTP_WINDOW, "Demasiadas operaciones administrativas. Intenta mas tarde.");
    }

    public void checkUpload(HttpServletRequest request, String uploadType) {
        String ip = clientIpResolver.resolve(request);
        String userKey = authenticatedUserKey();
        String normalizedType = normalizeIdentity(uploadType);
        String key = "http:upload:" + normalizedType + ":" + ip + ":" + userKey;
        enforce(key, UPLOAD_LIMIT, UPLOAD_WINDOW, "Demasiadas subidas de archivo. Intenta mas tarde.");
    }

    public void checkE2EPrivateKeyBackupPut(HttpServletRequest request, Long userId) {
        String ip = clientIpResolver.resolve(request);
        String userKey = authenticatedUserKey();
        String key = "http:e2e:backup:put:" + normalizeIdentity(String.valueOf(userId)) + ":" + ip + ":" + userKey;
        enforce(key, E2E_BACKUP_PUT_LIMIT, E2E_BACKUP_PUT_WINDOW,
                "Demasiadas actualizaciones de backup E2E. Intenta mas tarde.");
    }

    public void checkE2EPrivateKeyBackupGet(HttpServletRequest request, Long userId) {
        String ip = clientIpResolver.resolve(request);
        String userKey = authenticatedUserKey();
        String key = "http:e2e:backup:get:" + normalizeIdentity(String.valueOf(userId)) + ":" + ip + ":" + userKey;
        enforce(key, E2E_BACKUP_GET_LIMIT, E2E_BACKUP_GET_WINDOW,
                "Demasiadas consultas de backup E2E. Intenta mas tarde.");
    }

    private void enforce(String key, int limit, Duration window, String baseMessage) {
        RateLimitDecision decision = limiter.consume(key, limit, window);
        if (decision.allowed()) {
            return;
        }
        long retryAfter = decision.retryAfterSeconds();
        throw new TooManyRequestsException(baseMessage + " Reintenta en " + retryAfter + " segundos.", retryAfter);
    }

    private String normalizeIdentity(String raw) {
        if (raw == null || raw.isBlank()) {
            return "-";
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    private String authenticatedUserKey() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return "anon";
        }
        String name = auth.getName();
        if (name == null || name.isBlank() || "anonymousUser".equalsIgnoreCase(name)) {
            return "anon";
        }
        return name.trim().toLowerCase(Locale.ROOT);
    }
}
