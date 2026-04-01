package com.chat.chat.Exceptions;

import com.chat.chat.Utils.Constantes;

public class E2ERekeyConflictException extends RuntimeException {
    public E2ERekeyConflictException(String message) {
        super(message);
    }

    public String getCode() {
        return Constantes.ERR_E2E_REKEY_CONFLICT;
    }
}
