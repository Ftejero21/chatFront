package com.chat.chat.Service.AuthService;

import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

import com.chat.chat.Service.EmailService.EmailService;


import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PasswordResetService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetService.class);

    @Autowired
    private EmailService emailService; // <--- Inyectamos la interfaz

    private final Map<String, CodeDetails> resetCodes = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private static final long EXPIRATION_TIME_MS = 300_000;

    public void generateAndSendResetCode(String email) {
        LOGGER.info("[PASSWORD_RESET] generateAndSendResetCode email={}", email);
        String code = generateNumericCode();

        emailService.sendHtmlEmailOrThrow(
            email, 
            Constantes.EMAIL_SUBJECT_PASSWORD_RESET, 
            Constantes.EMAIL_TEMPLATE_PASSWORD_RESET, 
            Map.of(
                Constantes.KEY_CODE, code,
                Constantes.KEY_MINUTES, "5",
                Constantes.KEY_TITLE, Constantes.TITLE_PASSWORD_RESET
            )
        );

        resetCodes.put(email, new CodeDetails(code, System.currentTimeMillis() + EXPIRATION_TIME_MS));
    }

    public boolean isCodeValid(String email, String rawCode) {
        LOGGER.info("[PASSWORD_RESET] isCodeValid email={}", email);
        CodeDetails details = resetCodes.get(email);
        if (details == null) return false;

        if (System.currentTimeMillis() > details.expirationTimeMs) {
            resetCodes.remove(email);
            return false;
        }

        return details.code.equals(rawCode.trim());
    }

    public void invalidateCode(String email) {
        LOGGER.info("[PASSWORD_RESET] invalidateCode email={}", email);
        resetCodes.remove(email);
    }

    private String generateNumericCode() {
        return String.valueOf(100000 + random.nextInt(900000));
    }

    private static class CodeDetails {
        String code;
        long expirationTimeMs;
        CodeDetails(String code, long expirationTimeMs) {
            this.code = code;
            this.expirationTimeMs = expirationTimeMs;
        }
    }
}
