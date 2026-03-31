package com.chat.chat.Security;

import jakarta.annotation.PostConstruct;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.security.MessageDigest;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.HexFormat;
import java.util.function.Function;

@Service
public class JwtService {
    private static final Logger LOGGER = LoggerFactory.getLogger(JwtService.class);
    private static final String JWT_SECRET_PROP = "${app.jwt.secret:}";
    private static final String JWT_EXPIRATION_PROP = "${app.jwt.expiration:86400000}";
    private static final String JWT_CLOCK_SKEW_PROP = "${app.jwt.clock-skew-seconds:60}";
    private static final String JWT_ISSUER_PROP = "${app.jwt.issuer:}";
    private static final String JWT_AUDIENCE_PROP = "${app.jwt.audience:}";
    private static final int HS256_MIN_KEY_BYTES = 32;

    @Value(JWT_SECRET_PROP)
    private String secretKey;

    @Value(JWT_EXPIRATION_PROP) // 1 day in milliseconds
    private long jwtExpiration;

    @Value(JWT_CLOCK_SKEW_PROP)
    private long clockSkewSeconds;

    @Value(JWT_ISSUER_PROP)
    private String issuer;

    @Value(JWT_AUDIENCE_PROP)
    private String audience;

    private Key signingKey;

    @PostConstruct
    void initSigningKey() {
        this.signingKey = buildSigningKey(secretKey);
        LOGGER.info("[SEC_JWT] initialized expirationMs={} clockSkewSeconds={} issuer={} audience={} keyFp={}",
                jwtExpiration,
                clockSkewSeconds,
                normalizeOptional(issuer),
                normalizeOptional(audience),
                fingerprintKey(signingKey));
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return buildToken(extraClaims, userDetails, jwtExpiration);
    }

    private String buildToken(
            Map<String, Object> extraClaims,
            UserDetails userDetails,
            long expiration) {
        io.jsonwebtoken.JwtBuilder builder = Jwts
                .builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration));
        String normalizedIssuer = normalizeOptional(issuer);
        if (normalizedIssuer != null) {
            builder.setIssuer(normalizedIssuer);
        }
        String normalizedAudience = normalizeOptional(audience);
        if (normalizedAudience != null) {
            builder.setAudience(normalizedAudience);
        }
        return builder
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername())) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        io.jsonwebtoken.JwtParserBuilder builder = Jwts
                .parserBuilder()
                .setSigningKey(getSignInKey())
                .setAllowedClockSkewSeconds(Math.max(0L, clockSkewSeconds));
        String normalizedIssuer = normalizeOptional(issuer);
        if (normalizedIssuer != null) {
            builder.requireIssuer(normalizedIssuer);
        }
        String normalizedAudience = normalizeOptional(audience);
        if (normalizedAudience != null) {
            builder.requireAudience(normalizedAudience);
        }
        return builder.build().parseClaimsJws(token).getBody();
    }

    private Key getSignInKey() {
        if (signingKey == null) {
            signingKey = buildSigningKey(secretKey);
        }
        return signingKey;
    }

    private Key buildSigningKey(String configuredSecret) {
        if (configuredSecret == null || configuredSecret.isBlank()) {
            throw new IllegalStateException("app.jwt.secret is required and must be Base64 (>=32 bytes decoded)");
        }
        return keyFromBase64(configuredSecret.trim(), "app.jwt.secret");
    }

    private Key keyFromBase64(String base64Secret, String sourceName) {
        try {
            byte[] keyBytes = io.jsonwebtoken.io.Decoders.BASE64.decode(base64Secret);
            if (keyBytes.length < HS256_MIN_KEY_BYTES) {
                throw new IllegalStateException(sourceName + " must decode to at least 32 bytes for HS256");
            }
            return Keys.hmacShaKeyFor(keyBytes);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(sourceName + " must be valid Base64", ex);
        }
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String fingerprintKey(Key key) {
        if (key == null || key.getEncoded() == null) {
            return "null";
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getEncoded());
            return HexFormat.of().formatHex(digest).substring(0, 12);
        } catch (Exception ex) {
            return "unavailable";
        }
    }
}
