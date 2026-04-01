package com.chat.chat.Exceptions;

import com.chat.chat.Utils.Constantes;
public class UsuarioInactivoException extends RuntimeException {
    public UsuarioInactivoException() {
        super(Constantes.MSG_CUENTA_INHABILITADA);
    }

    public UsuarioInactivoException(String message) {
        super(message);
    }
}
