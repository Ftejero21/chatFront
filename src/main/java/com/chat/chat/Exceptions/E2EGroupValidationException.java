package com.chat.chat.Exceptions;

public class E2EGroupValidationException extends RuntimeException {
    private final String code;

    public E2EGroupValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
