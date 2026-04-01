package com.chat.chat.Service.MensajeProgramadoService;

public class ExcepcionCifradoProgramado extends RuntimeException {

    private final boolean recuperable;

    public ExcepcionCifradoProgramado(String message, boolean recuperable) {
        super(message);
        this.recuperable = recuperable;
    }

    public ExcepcionCifradoProgramado(String message, Throwable cause, boolean recuperable) {
        super(message, cause);
        this.recuperable = recuperable;
    }

    public boolean isRecuperable() {
        return recuperable;
    }
}
