package com.chat.chat.Controller;

import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Service.MensajeriaService.MensajeriaService;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(Constantes.API_MENSAJERIA)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Mensajeria", description = "Operaciones REST de apoyo para gestion de estado de mensajes.")
public class MensajeriaController {

    @Autowired
    private MensajeriaService mensajeriaService;

    @PostMapping(Constantes.MENSAJES_MARCAR_LEIDOS)
    @Operation(summary = "Marcar mensajes como leidos", description = "Recibe una lista de IDs y marca esos mensajes como leidos.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Mensajes actualizados"),
            @ApiResponse(responseCode = "400", description = "Lista de IDs invalida", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> marcarMensajesComoLeidos(@RequestBody List<Long> ids) {
        mensajeriaService.marcarMensajesComoLeidos(ids);
        return ResponseEntity.ok().build();
    }
}
