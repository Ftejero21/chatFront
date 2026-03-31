package com.chat.chat.Exceptions;

import java.util.List;

public class ValidacionPayloadException extends RuntimeException {
    private final List<String> detalleCampos;

    public ValidacionPayloadException(String message, List<String> detalleCampos) {
        super(message);
        this.detalleCampos = detalleCampos == null ? List.of() : detalleCampos;
    }

    public List<String> getDetalleCampos() {
        return detalleCampos;
    }
}
