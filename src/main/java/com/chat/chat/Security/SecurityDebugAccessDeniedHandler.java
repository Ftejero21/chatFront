package com.chat.chat.Security;

import com.chat.chat.Utils.Constantes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class SecurityDebugAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(SecurityDebugAccessDeniedHandler.class);

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        String traceId = SecurityTraceSupport.resolveOrCreateTraceId(request);
        SecurityTraceSupport.attachTraceId(response, traceId);
        String cause = resolveCause(request, accessDeniedException);

        LOGGER.warn("[SEC_AUTH] traceId={} type=FORBIDDEN method={} uri={} cause={} origin={} authPresent={}",
                traceId,
                request.getMethod(),
                request.getRequestURI(),
                cause,
                request.getHeader("Origin"),
                isAuthenticated());

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"code\":\"" + Constantes.ERR_NO_AUTORIZADO
                        + "\",\"message\":\"Acceso denegado\""
                        + ",\"reason\":\"" + cause + "\""
                        + ",\"traceId\":\"" + traceId + "\"}");
    }

    private String resolveCause(HttpServletRequest request, AccessDeniedException ex) {
        String corsFailure = (String) request.getAttribute(CorsPreflightDebugFilter.ATTR_CORS_FAILURE_REASON);
        if (corsFailure != null) {
            return "CORS_PREFLIGHT_" + corsFailure;
        }

        if (ex instanceof InvalidCsrfTokenException || ex instanceof MissingCsrfTokenException) {
            return "CSRF";
        }

        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return "CORS_PREFLIGHT";
        }

        if (!isAuthenticated()) {
            String jwtReason = (String) request.getAttribute(JwtAuthFilter.ATTR_AUTH_FAILURE_REASON);
            return jwtReason != null ? jwtReason : "AUTH_REQUIRED";
        }

        return "MISSING_ROLE";
    }

    private boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }

}
