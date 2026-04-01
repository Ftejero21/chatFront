package com.chat.chat.Configuracion;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EstadoUsuarioManager {
    private final Map<Long, Boolean> estadoUsuarios = new ConcurrentHashMap<>();

    public void marcarConectado(Long usuarioId) {
        estadoUsuarios.put(usuarioId, true);
    }

    public void marcarDesconectado(Long usuarioId) {
        estadoUsuarios.put(usuarioId, false);
    }

    public boolean estaConectado(Long usuarioId) {
        return estadoUsuarios.getOrDefault(usuarioId, false);
    }

    public Map<Long, Boolean> getEstadosDeUsuarios() {
        return estadoUsuarios;
    }
}
