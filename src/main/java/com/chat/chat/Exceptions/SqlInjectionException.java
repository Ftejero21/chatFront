package com.chat.chat.Exceptions;

public class SqlInjectionException extends RuntimeException {

    public SqlInjectionException(String message) {
        super(message);
    }
}
