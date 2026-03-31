package com.chat.chat.Exceptions;

public class UploadSecurityException extends RuntimeException {
    private final String code;

    public UploadSecurityException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
