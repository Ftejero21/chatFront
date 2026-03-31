package com.chat.chat.Exceptions;

import com.chat.chat.Utils.Constantes;

public class ConflictoException extends RuntimeException {
    private final String code;

    public ConflictoException(String message) {
        this(Constantes.ERR_CONFLICTO, message);
    }

    public ConflictoException(String code, String message) {
        super(message);
        this.code = (code == null || code.isBlank()) ? Constantes.ERR_CONFLICTO : code;
    }

    public String getCode() {
        return code;
    }
}
