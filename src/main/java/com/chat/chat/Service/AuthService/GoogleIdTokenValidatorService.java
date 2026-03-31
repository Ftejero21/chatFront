package com.chat.chat.Service.AuthService;

import com.chat.chat.DTO.GoogleTokenPayloadDTO;
import com.chat.chat.Exceptions.GoogleAuthException;
import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class GoogleIdTokenValidatorService {

    private static final String GOOGLE_ISSUER_HTTPS = "https://accounts.google.com";
    private static final String GOOGLE_ISSUER_BARE = "accounts.google.com";
    private static final String GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

    private final JwtDecoder jwtDecoder;
    private final String googleClientId;

    public GoogleIdTokenValidatorService(
            @Value("${app.auth.google.client-id:${GOOGLE_CLIENT_ID:}}") String googleClientId) {

        this.googleClientId = googleClientId == null ? "" : googleClientId.trim();
        if (this.googleClientId.isBlank()) {
            throw new IllegalStateException("GOOGLE_CLIENT_ID no configurado en backend");
        }

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWKS_URI).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                issuerValidator(),
                audienceValidator(this.googleClientId)
        ));
        this.jwtDecoder = decoder;
    }

    public GoogleTokenPayloadDTO validarYExtraer(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_TOKEN_INVALIDO,
                    "Google ID token es obligatorio");
        }

        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(idToken);
        } catch (JwtException ex) {
            throw new GoogleAuthException(
                    HttpStatus.UNAUTHORIZED,
                    Constantes.ERR_GOOGLE_TOKEN_INVALIDO,
                    "Google ID token invalido o expirado");
        }

        String email = normalizeEmail(jwt.getClaimAsString(Constantes.KEY_EMAIL));
        String sub = safeTrim(jwt.getSubject());
        if (email == null || sub == null) {
            throw new GoogleAuthException(
                    HttpStatus.BAD_REQUEST,
                    Constantes.ERR_GOOGLE_TOKEN_INVALIDO,
                    "Google ID token sin claims requeridos (email/sub)");
        }

        GoogleTokenPayloadDTO payload = new GoogleTokenPayloadDTO();
        payload.setSub(sub);
        payload.setEmail(email);
        payload.setNombre(resolveNombre(jwt));
        payload.setApellido(resolveApellido(jwt));
        payload.setFoto(safeTrim(jwt.getClaimAsString("picture")));
        return payload;
    }

    private OAuth2TokenValidator<Jwt> issuerValidator() {
        return token -> {
            String iss = safeTrim(token.getClaimAsString("iss"));
            boolean valido = GOOGLE_ISSUER_HTTPS.equals(iss) || GOOGLE_ISSUER_BARE.equals(iss);
            if (valido) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "invalid_token",
                    "Issuer invalido para Google ID token",
                    null
            ));
        };
    }

    private OAuth2TokenValidator<Jwt> audienceValidator(String requiredAudience) {
        return token -> {
            if (token.getAudience() != null && token.getAudience().contains(requiredAudience)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "invalid_token",
                    "Audience invalida para Google ID token",
                    null
            ));
        };
    }

    private String resolveNombre(Jwt jwt) {
        String nombre = safeTrim(jwt.getClaimAsString("given_name"));
        if (nombre != null) {
            return nombre;
        }
        String fullName = safeTrim(jwt.getClaimAsString("name"));
        if (fullName == null) {
            return "Usuario";
        }
        int firstSpace = fullName.indexOf(' ');
        return firstSpace <= 0 ? fullName : fullName.substring(0, firstSpace);
    }

    private String resolveApellido(Jwt jwt) {
        String apellido = safeTrim(jwt.getClaimAsString("family_name"));
        if (apellido != null) {
            return apellido;
        }
        String fullName = safeTrim(jwt.getClaimAsString("name"));
        if (fullName == null) {
            return "";
        }
        int firstSpace = fullName.indexOf(' ');
        if (firstSpace <= 0 || firstSpace >= fullName.length() - 1) {
            return "";
        }
        return fullName.substring(firstSpace + 1).trim();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    private String safeTrim(String value) {
        if (value == null) {
            return null;
        }
        String out = value.trim();
        return out.isBlank() ? null : out;
    }
}
