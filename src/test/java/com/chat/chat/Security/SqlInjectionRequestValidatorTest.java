package com.chat.chat.Security;

import com.chat.chat.Exceptions.SqlInjectionException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SqlInjectionRequestValidatorTest {

    private final SqlInjectionRequestValidator validator =
            new SqlInjectionRequestValidator(new SqlInjectionDetector());

    @Test
    void validate_noBloqueaPayloadLegitimo() {
        Payload payload = new Payload();
        payload.email = "usuario@correo.com";
        payload.motivo = "Necesito recuperar mi cuenta, gracias.";
        payload.tags = List.of("soporte", "desbaneo");
        payload.meta = Map.of("origen", "login");
        payload.extra = Optional.of("texto normal");

        assertDoesNotThrow(() -> validator.validate(payload));
    }

    @Test
    void validate_bloqueaPatronUnionSelect() {
        Payload payload = new Payload();
        payload.motivo = "hola UNION SELECT password FROM users";

        SqlInjectionException ex = assertThrows(SqlInjectionException.class, () -> validator.validate(payload));
        assertTrue(ex.getMessage().contains("body.motivo"));
    }

    @Test
    void validate_bloqueaPatronEnAnidadoYMap() {
        Nested nested = new Nested();
        nested.detalle = "ok";
        nested.comentario = "1 OR 1=1";

        Payload payload = new Payload();
        payload.nested = nested;
        payload.meta = Map.of("campo", "x'; DROP TABLE usuarios; --");

        SqlInjectionException ex = assertThrows(SqlInjectionException.class, () -> validator.validate(payload));
        assertTrue(ex.getMessage().contains("body.nested.comentario")
                || ex.getMessage().contains("body.meta.campo"));
    }

    private static class Payload {
        String email;
        String motivo;
        List<String> tags;
        Map<String, String> meta;
        Optional<String> extra;
        Nested nested;
    }

    private static class Nested {
        String detalle;
        String comentario;
    }
}
