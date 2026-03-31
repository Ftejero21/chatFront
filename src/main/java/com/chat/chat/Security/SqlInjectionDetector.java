package com.chat.chat.Security;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

@Component
public class SqlInjectionDetector {

    private static final List<Pattern> DANGEROUS_PATTERNS = List.of(
            // SQL keyword combined with SQL comment token.
            Pattern.compile("(?i)\\b(select|insert|update|delete|drop|alter|create|truncate|union|exec|execute)\\b[\\s\\S]*(--|/\\*|\\*/)"),
            // Stacked query attempt: ; SELECT ... ; DROP ...
            Pattern.compile("(?i);\\s*(select|insert|update|delete|drop|alter|create|truncate|exec|execute)\\b"),
            // Classic UNION-based extraction.
            Pattern.compile("(?i)\\bunion\\s+(all\\s+)?select\\b"),
            // Boolean-based tautology payloads.
            Pattern.compile("(?i)\\b(or|and)\\b\\s+\\d+\\s*=\\s*\\d+\\b"),
            Pattern.compile("(?i)\\b(or|and)\\b\\s+'[^']*'\\s*=\\s*'[^']*'"),
            // DB metadata/functions frequently seen in injection payloads.
            Pattern.compile("(?i)\\b(information_schema|xp_cmdshell|benchmark\\s*\\(|sleep\\s*\\()")
    );

    public boolean containsRisk(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        String input = value.trim();
        for (Pattern pattern : DANGEROUS_PATTERNS) {
            if (pattern.matcher(input).find()) {
                return true;
            }
        }
        return false;
    }
}
