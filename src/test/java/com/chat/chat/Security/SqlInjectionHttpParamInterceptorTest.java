package com.chat.chat.Security;

import com.chat.chat.Exceptions.SqlInjectionException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SqlInjectionHttpParamInterceptorTest {

    private final SqlInjectionHttpParamInterceptor interceptor =
            new SqlInjectionHttpParamInterceptor(new SqlInjectionDetector());

    @Test
    void preHandle_permiteParamsNormales() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("q", "busqueda normal");
        request.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("id", "123"));

        assertDoesNotThrow(() -> interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void preHandle_bloqueaQueryParamMalicioso() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("q", "x'; DROP TABLE usuarios; --");

        assertThrows(SqlInjectionException.class,
                () -> interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void preHandle_bloqueaPathVariableMaliciosa() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(
                HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE,
                Map.of("chatId", "1 UNION SELECT password FROM users"));

        assertThrows(SqlInjectionException.class,
                () -> interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }
}
