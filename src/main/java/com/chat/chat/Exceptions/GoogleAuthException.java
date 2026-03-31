package com.chat.chat.Exceptions;

import org.springframework.http.HttpStatus;

public class GoogleAuthException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public GoogleAuthException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
