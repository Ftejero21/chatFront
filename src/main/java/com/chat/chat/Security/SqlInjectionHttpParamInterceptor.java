package com.chat.chat.Security;

import com.chat.chat.Exceptions.SqlInjectionException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;

@Component
public class SqlInjectionHttpParamInterceptor implements HandlerInterceptor {

    private final SqlInjectionDetector detector;

    public SqlInjectionHttpParamInterceptor(SqlInjectionDetector detector) {
        this.detector = detector;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        validateQueryParams(request);
        validatePathVariables(request);
        return true;
    }

    private void validateQueryParams(HttpServletRequest request) {
        Map<String, String[]> paramMap = request.getParameterMap();
        if (paramMap == null || paramMap.isEmpty()) {
            return;
        }

        for (Map.Entry<String, String[]> entry : paramMap.entrySet()) {
            String paramName = entry.getKey();
            String[] values = entry.getValue();
            if (values == null) {
                continue;
            }
            for (String value : values) {
                if (detector.containsRisk(value)) {
                    throw new SqlInjectionException("Entrada invalida detectada en query param '" + paramName + "'");
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void validatePathVariables(HttpServletRequest request) {
        Object attr = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (!(attr instanceof Map<?, ?> rawMap)) {
            return;
        }

        Map<String, String> pathVars = (Map<String, String>) rawMap;
        for (Map.Entry<String, String> entry : pathVars.entrySet()) {
            String name = entry.getKey();
            String value = entry.getValue();
            if (detector.containsRisk(value)) {
                throw new SqlInjectionException("Entrada invalida detectada en path variable '" + name + "'");
            }
        }
    }
}
