package com.chat.chat.Exceptions;

import com.chat.chat.Utils.Constantes;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.UNAUTHORIZED)
public class PasswordIncorrectaException extends RuntimeException {
    public PasswordIncorrectaException() { this(Constantes.MSG_PASSWORD_INCORRECTA); }
    public PasswordIncorrectaException(String message) { super(message); }
}
