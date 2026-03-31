package com.chat.chat.Controller;

import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Utils.AdminAuditCrypto;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping(Constantes.API_KEYS)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Claves", description = "Publicacion de claves publicas para operaciones criptograficas.")
public class KeysController {

    @Autowired
    private AdminAuditCrypto adminAuditCrypto;

    @GetMapping(Constantes.KEYS_AUDIT_PUBLIC)
    @Operation(summary = "Obtener clave publica de auditoria", description = "Devuelve la clave publica RSA usada para cifrar informacion de auditoria para administradores.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Clave disponible", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "500", description = "Clave no disponible", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> getAuditPublicKey() {
        String auditPublicKey = adminAuditCrypto.getAuditPublicKeySpkiBase64();
        if (auditPublicKey == null || auditPublicKey.isBlank()) {
            return ResponseEntity.internalServerError()
                    .body(Map.of(Constantes.KEY_MENSAJE, "Audit public key unavailable"));
        }

        Map<String, String> payload = new LinkedHashMap<>();
        payload.put(Constantes.KEY_PUBLIC_KEY, auditPublicKey);
        payload.put(Constantes.KEY_AUDIT_PUBLIC_KEY, auditPublicKey);
        return ResponseEntity.ok(payload);
    }
}
