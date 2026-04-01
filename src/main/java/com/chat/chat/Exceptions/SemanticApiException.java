package com.chat.chat.Exceptions;

import org.springframework.http.HttpStatus;

public class SemanticApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String traceId;

    public SemanticApiException(HttpStatus status, String code, String message, String traceId) {
        super(message);
        this.status = status;
        this.code = code;
        this.traceId = traceId;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getTraceId() {
        return traceId;
    }
}
