package com.chat.chat.Controller;

import com.chat.chat.Configuracion.EstadoUsuarioManager;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(Constantes.API_ESTADO)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Estado de Usuarios", description = "Consulta de presencia/conexion de usuarios en tiempo real.")
public class EstadoUsuarioRestController {

    @Autowired
    private EstadoUsuarioManager estadoUsuarioManager;

    @PostMapping(Constantes.USUARIOS_SUB)
    @Operation(summary = "Consultar presencia por lote", description = "Recibe lista de IDs y devuelve si cada usuario esta conectado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Estado de presencia obtenido", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "400", description = "Lista de IDs invalida")
    })
    public Map<Long, Boolean> obtenerEstadosUsuarios(@RequestBody List<Long> usuarioIds) {
        Map<Long, Boolean> resultado = new HashMap<>();
        for (Long id : usuarioIds) {
            resultado.put(id, estadoUsuarioManager.estaConectado(id));
        }
        return resultado;
    }
}
