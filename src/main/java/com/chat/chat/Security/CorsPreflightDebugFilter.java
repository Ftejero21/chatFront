package com.chat.chat.Security;

import com.chat.chat.Utils.Constantes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class CorsPreflightDebugFilter extends OncePerRequestFilter {

    public static final String ATTR_CORS_FAILURE_REASON = "security.cors.failure.reason";

    private static final Logger LOGGER = LoggerFactory.getLogger(CorsPreflightDebugFilter.class);
    private static final Set<String> ALLOWED_HEADERS = Set.of("authorization", "content-type", "accept");

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (isUploadsApi(request) && isPreflight(request)) {
            String origin = request.getHeader("Origin");
            String requestedMethod = request.getHeader("Access-Control-Request-Method");
            String requestedHeaders = request.getHeader("Access-Control-Request-Headers");

            String reason = validatePreflight(origin, requestedMethod, requestedHeaders);
            if (reason == null) {
                LOGGER.info("[SEC_403_DEBUG] type=CORS_PREFLIGHT_OK method={} uri={} origin={} reqMethod={} reqHeaders={}",
                        request.getMethod(),
                        request.getRequestURI(),
                        origin,
                        requestedMethod,
                        requestedHeaders);
            } else {
                request.setAttribute(ATTR_CORS_FAILURE_REASON, reason);
                LOGGER.warn("[SEC_403_DEBUG] type=CORS_PREFLIGHT_BLOCK method={} uri={} reason={} origin={} reqMethod={} reqHeaders={}",
                        request.getMethod(),
                        request.getRequestURI(),
                        reason,
                        origin,
                        requestedMethod,
                        requestedHeaders);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String validatePreflight(String origin, String requestedMethod, String requestedHeaders) {
        if (!Constantes.CORS_ORIGIN_LOCALHOST_4200.equals(origin)) {
            return "ORIGIN_NOT_ALLOWED";
        }
        if (requestedMethod == null || !HttpMethod.POST.matches(requestedMethod)) {
            return "METHOD_NOT_ALLOWED";
        }
        if (requestedHeaders == null || requestedHeaders.isBlank()) {
            return null;
        }

        Set<String> incoming = Arrays.stream(requestedHeaders.split(","))
                .map(String::trim)
                .filter(h -> !h.isBlank())
                .map(h -> h.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        boolean headersAllowed = ALLOWED_HEADERS.containsAll(incoming);
        return headersAllowed ? null : "HEADER_NOT_ALLOWED";
    }

    private boolean isPreflight(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod())
                && request.getHeader("Origin") != null
                && request.getHeader("Access-Control-Request-Method") != null;
    }

    private boolean isUploadsApi(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null && uri.startsWith(Constantes.API_UPLOADS_ALL);
    }
}
