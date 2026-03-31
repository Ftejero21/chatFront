package com.chat.chat.Service.AuthService;

import com.chat.chat.Utils.Constantes;
import com.chat.chat.Service.EmailService.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PasswordChangeService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordChangeService.class);

    @Autowired
    private EmailService emailService;

    private final Map<String, CodeDetails> changeCodes = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private static final long EXPIRATION_TIME_MS = 300_000;

    public void generateAndSendChangeCode(String email, String nombre) {
        LOGGER.info("[PASSWORD_CHANGE] generateAndSendChangeCode email={}", email);
        String code = generateNumericCode();

        emailService.sendHtmlEmailOrThrow(
                email,
                Constantes.EMAIL_SUBJECT_PASSWORD_CHANGE,
                Constantes.EMAIL_TEMPLATE_PASSWORD_CHANGE,
                Map.of(
                        Constantes.KEY_CODE, code,
                        Constantes.KEY_MINUTES, "5",
                        Constantes.KEY_TITLE, Constantes.TITLE_PASSWORD_CHANGE
                )
        );

        changeCodes.put(email, new CodeDetails(code, System.currentTimeMillis() + EXPIRATION_TIME_MS));
    }

    public boolean isCodeValid(String email, String rawCode) {
        LOGGER.info("[PASSWORD_CHANGE] isCodeValid email={}", email);
        CodeDetails details = changeCodes.get(email);
        if (details == null) return false;

        if (System.currentTimeMillis() > details.expirationTimeMs) {
            changeCodes.remove(email);
            return false;
        }

        return details.code.equals(rawCode.trim());
    }

    public void invalidateCode(String email) {
        LOGGER.info("[PASSWORD_CHANGE] invalidateCode email={}", email);
        changeCodes.remove(email);
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
