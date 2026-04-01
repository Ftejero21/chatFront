package com.chat.chat.Security;

import com.chat.chat.Utils.Constantes;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String ATTR_AUTH_FAILURE_REASON = "security.auth.failure.reason";
    public static final String ATTR_AUTH_FAILURE_DETAIL = "security.auth.failure.detail";

    private static final Logger LOGGER = LoggerFactory.getLogger(JwtAuthFilter.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        String traceId = SecurityTraceSupport.resolveOrCreateTraceId(request);

        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = resolveBearerToken(request);
        if (jwt == null) {
            if (isApiRequest(request) && request.getAttribute(ATTR_AUTH_FAILURE_REASON) == null) {
                request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_MISSING");
                request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, "Authorization header missing");
            }
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String userEmail = jwtService.extractUsername(jwt);
            if (userEmail == null || userEmail.isBlank()) {
                request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_SUBJECT_MISSING");
                request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, "JWT subject is missing");
                filterChain.doFilter(request, response);
                return;
            }

            Authentication currentAuth = SecurityContextHolder.getContext().getAuthentication();
            boolean canSetAuthentication = currentAuth == null
                    || !currentAuth.isAuthenticated()
                    || currentAuth instanceof AnonymousAuthenticationToken;
            if (canSetAuthentication) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);

                    LOGGER.debug("[SEC_AUTH] traceId={} type=JWT_OK method={} uri={} user={}",
                            traceId,
                            request.getMethod(),
                            request.getRequestURI(),
                            userEmail);
                } else {
                    request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_INVALID");
                    request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, "TOKEN_SUBJECT_MISMATCH_OR_EXPIRED");
                    LOGGER.warn("[SEC_AUTH] traceId={} type=JWT_FAIL method={} uri={} reason={} user={}",
                            traceId,
                            request.getMethod(),
                            request.getRequestURI(),
                            "JWT_INVALID",
                            userEmail);
                }
            } else {
                LOGGER.debug("[SEC_AUTH] traceId={} type=JWT_SKIP method={} uri={} reason=AUTH_ALREADY_PRESENT principal={}",
                        traceId,
                        request.getMethod(),
                        request.getRequestURI(),
                        currentAuth.getName());
            }
        } catch (ExpiredJwtException ex) {
            request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_EXPIRED");
            request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, ex.getClass().getSimpleName());
            LOGGER.warn("[SEC_AUTH] traceId={} type=JWT_FAIL method={} uri={} reason={} detail={}",
                    traceId,
                    request.getMethod(),
                    request.getRequestURI(),
                    "JWT_EXPIRED",
                    ex.getClass().getSimpleName());
        } catch (UsernameNotFoundException ex) {
            request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_USER_NOT_FOUND");
            request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, ex.getClass().getSimpleName());
            LOGGER.warn("[SEC_AUTH] traceId={} type=JWT_FAIL method={} uri={} reason={} detail={}",
                    traceId,
                    request.getMethod(),
                    request.getRequestURI(),
                    "JWT_USER_NOT_FOUND",
                    ex.getClass().getSimpleName());
        } catch (JwtException | IllegalArgumentException ex) {
            request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_INVALID");
            request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, ex.getClass().getSimpleName());
            LOGGER.warn("[SEC_AUTH] traceId={} type=JWT_FAIL method={} uri={} reason={} detail={}",
                    traceId,
                    request.getMethod(),
                    request.getRequestURI(),
                    "JWT_INVALID",
                    ex.getClass().getSimpleName());
        }

        filterChain.doFilter(request, response);
    }

    private String resolveBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader(Constantes.HEADER_AUTHORIZATION);
        if (authHeader == null || authHeader.isBlank()) {
            return null;
        }
        String normalized = authHeader.trim();
        if (normalized.length() < Constantes.BEARER_PREFIX.length()
                || !normalized.regionMatches(true, 0, Constantes.BEARER_PREFIX, 0, Constantes.BEARER_PREFIX.length())) {
            request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_SCHEME_INVALID");
            request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, "Expected Bearer scheme");
            return null;
        }
        String token = normalized.substring(Constantes.BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            request.setAttribute(ATTR_AUTH_FAILURE_REASON, "JWT_TOKEN_MISSING");
            request.setAttribute(ATTR_AUTH_FAILURE_DETAIL, "Bearer token is empty");
            return null;
        }
        // Defensive normalization if header contained accidental "Bearer Bearer <token>"
        if (token.toLowerCase(Locale.ROOT).startsWith(Constantes.BEARER_PREFIX.toLowerCase(Locale.ROOT))) {
            token = token.substring(Constantes.BEARER_PREFIX.length()).trim();
        }
        return token.isEmpty() ? null : token;
    }

    private boolean isApiRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null && uri.startsWith("/api/");
    }
}
