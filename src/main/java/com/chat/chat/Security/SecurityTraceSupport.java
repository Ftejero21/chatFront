package com.chat.chat.Security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.UUID;

final class SecurityTraceSupport {

    static final String ATTR_TRACE_ID = "security.trace.id";
    static final String HEADER_TRACE_ID = "X-Trace-Id";

    private SecurityTraceSupport() {
    }

    static String resolveOrCreateTraceId(HttpServletRequest request) {
        Object existing = request.getAttribute(ATTR_TRACE_ID);
        if (existing instanceof String value && !value.isBlank()) {
            return value;
        }

        String fromHeader = request.getHeader(HEADER_TRACE_ID);
        String traceId = (fromHeader != null && !fromHeader.isBlank())
                ? fromHeader.trim()
                : UUID.randomUUID().toString();
        request.setAttribute(ATTR_TRACE_ID, traceId);
        return traceId;
    }

    static void attachTraceId(HttpServletResponse response, String traceId) {
        if (response == null || traceId == null || traceId.isBlank()) {
            return;
        }
        response.setHeader(HEADER_TRACE_ID, traceId);
    }
}
