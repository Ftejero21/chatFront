package com.chat.chat.Controller;

import com.chat.chat.DTO.ActualizarPerfilDTO;
import com.chat.chat.DTO.AuthRespuestaDTO;
import com.chat.chat.DTO.DashboardStatsDTO;
import com.chat.chat.DTO.E2EPrivateKeyBackupDTO;
import com.chat.chat.DTO.E2ERekeyRequestDTO;
import com.chat.chat.DTO.E2EStateDTO;
import com.chat.chat.DTO.GoogleAuthRequestDTO;
import com.chat.chat.DTO.LoginRequestDTO;
import com.chat.chat.DTO.PasswordChangeConfirmDTO;
import com.chat.chat.DTO.PasswordChangeCodeRequestDTO;
import com.chat.chat.DTO.UsuarioDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Exceptions.PasswordIncorrectaException;
import com.chat.chat.Service.AuthService.PasswordResetService;
import com.chat.chat.Security.HttpRateLimitService;
import com.chat.chat.Service.UsuarioService.UsuarioService;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping(Constantes.USUARIO_API)
@CrossOrigin(Constantes.CORS_ANY_ORIGIN)
@Tag(name = "Usuarios y Autenticacion", description = "Endpoints para login, registro, perfil, seguridad E2E y administracion de usuarios.")
public class UsuarioController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private PasswordResetService passwordResetService;

    @Autowired
    private HttpRateLimitService httpRateLimitService;

    @PostMapping(Constantes.LOGIN)
    @Operation(summary = "Iniciar sesion", description = "Autentica por email y password y devuelve token JWT y datos del usuario.", security = {})
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Login correcto", content = @Content(schema = @Schema(implementation = AuthRespuestaDTO.class))),
            @ApiResponse(responseCode = "400", description = "Datos invalidos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "401", description = "Credenciales incorrectas", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "Usuario inactivo", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public AuthRespuestaDTO login(@RequestBody LoginRequestDTO dto, HttpServletRequest request) {
        httpRateLimitService.checkLogin(request, dto == null ? null : dto.getEmail());
        return usuarioService.loginConToken(dto.getEmail(), dto.getPassword());
    }

    @PostMapping(Constantes.REGISTRO)
    @Operation(summary = "Registrar usuario", description = "Crea una cuenta nueva y devuelve token JWT para sesion inicial.", security = {})
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario registrado", content = @Content(schema = @Schema(implementation = AuthRespuestaDTO.class))),
            @ApiResponse(responseCode = "400", description = "Datos invalidos", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Email ya registrado", content = @Content(schema = @Schema(implementation = Map.class)))
    })
    public AuthRespuestaDTO crearUsuario(@RequestBody UsuarioDTO dto) {
        return usuarioService.crearUsuarioConToken(dto);
    }

    @PostMapping(Constantes.GOOGLE_AUTH)
    @Operation(summary = "Autenticacion con Google", description = "Autentica o registra con Google ID token segun mode.", security = {})
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Operacion correcta", content = @Content(schema = @Schema(implementation = AuthRespuestaDTO.class))),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "401", description = "Google token invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no registrado para login", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Email ya registrado", content = @Content(schema = @Schema(implementation = Map.class)))
    })
    public AuthRespuestaDTO autenticarGoogle(@RequestBody GoogleAuthRequestDTO dto) {
        return usuarioService.autenticarConGoogle(dto);
    }

    @PostMapping(Constantes.GOOGLE_AUTH_ALIAS)
    @Operation(summary = "Alias autenticacion Google", description = "Alias compatible de /google.", security = {})
    public AuthRespuestaDTO autenticarGoogleAlias(@RequestBody GoogleAuthRequestDTO dto) {
        return usuarioService.autenticarConGoogle(dto);
    }

    @PostMapping(Constantes.GOOGLE_AUTH_POR_MODO)
    @Operation(summary = "Alias autenticacion Google por modo", description = "Alias compatible /{mode}/google.", security = {})
    public AuthRespuestaDTO autenticarGooglePorModo(@PathVariable("mode") String mode, @RequestBody GoogleAuthRequestDTO dto) {
        return usuarioService.autenticarConGoogle(mode, dto);
    }

    @GetMapping(Constantes.USUARIOS_ACTIVOS)
    @Operation(summary = "Listar usuarios activos", description = "Devuelve usuarios habilitados para iniciar chats.")
    @ApiResponse(responseCode = "200", description = "Listado obtenido")
    public List<UsuarioDTO> listarActivos() {
        return usuarioService.listarUsuariosActivos();
    }

    @GetMapping(Constantes.USUARIO_POR_ID)
    @Operation(summary = "Obtener usuario por ID", description = "Consulta el detalle de un usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario encontrado", content = @Content(schema = @Schema(implementation = UsuarioDTO.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public UsuarioDTO getById(@PathVariable("id") Long id) {
        return usuarioService.getById(id);
    }

    @GetMapping(Constantes.USUARIO_BUSCAR)
    @Operation(summary = "Buscar usuarios", description = "Busca por nombre o apellido usando texto libre.")
    @ApiResponse(responseCode = "200", description = "Resultados de busqueda")
    public List<UsuarioDTO> buscar(@Parameter(description = "Texto a buscar") @RequestParam(Constantes.KEY_Q) String q) {
        return usuarioService.buscarPorNombre(q);
    }

    @PutMapping(Constantes.USUARIO_PUBLIC_KEY)
    @Operation(summary = "Actualizar clave publica E2E", description = "Guarda o rota la clave publica del usuario para cifrado extremo a extremo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Clave actualizada"),
            @ApiResponse(responseCode = "400", description = "Payload invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public void updatePublicKey(@PathVariable("id") Long id, @RequestBody Map<String, String> payload) {
        String publicKey = payload.get(Constantes.KEY_PUBLIC_KEY);
        usuarioService.updatePublicKey(id, publicKey);
    }

    @GetMapping(Constantes.USUARIO_E2E_STATE)
    @Operation(summary = "Consultar estado E2E", description = "Devuelve version y metadatos actuales del estado de claves E2E del usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Estado E2E obtenido", content = @Content(schema = @Schema(implementation = E2EStateDTO.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public E2EStateDTO getE2EState(@PathVariable("id") Long id) {
        return usuarioService.getE2EState(id);
    }

    @PostMapping(Constantes.USUARIO_E2E_REKEY)
    @Operation(summary = "Rotar claves E2E", description = "Actualiza las claves E2E del usuario y devuelve el nuevo estado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Rekey aplicado", content = @Content(schema = @Schema(implementation = E2EStateDTO.class))),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Conflicto de version E2E", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public E2EStateDTO rekeyE2E(@PathVariable("id") Long id, @RequestBody E2ERekeyRequestDTO request) {
        return usuarioService.rekeyE2E(id, request);
    }

    @PutMapping(Constantes.USUARIO_E2E_PRIVATE_KEY_BACKUP)
    @Operation(summary = "Guardar backup de clave privada E2E", description = "Crea o actualiza el backup cifrado de la clave privada del usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Backup guardado o actualizado"),
            @ApiResponse(responseCode = "400", description = "Payload invalido", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "No autorizado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Void> upsertE2EPrivateKeyBackup(
            @PathVariable("userId") Long userId,
            @RequestBody E2EPrivateKeyBackupDTO request,
            HttpServletRequest httpRequest) {
        httpRateLimitService.checkE2EPrivateKeyBackupPut(httpRequest, userId);
        usuarioService.upsertE2EPrivateKeyBackup(userId, request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(Constantes.USUARIO_E2E_PRIVATE_KEY_BACKUP)
    @Operation(summary = "Obtener backup de clave privada E2E", description = "Devuelve el backup cifrado de la clave privada del usuario.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Backup encontrado", content = @Content(schema = @Schema(implementation = E2EPrivateKeyBackupDTO.class))),
            @ApiResponse(responseCode = "404", description = "Backup no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "403", description = "No autorizado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public E2EPrivateKeyBackupDTO getE2EPrivateKeyBackup(
            @PathVariable("userId") Long userId,
            HttpServletRequest httpRequest) {
        httpRateLimitService.checkE2EPrivateKeyBackupGet(httpRequest, userId);
        return usuarioService.getE2EPrivateKeyBackup(userId);
    }

    @PostMapping(Constantes.USUARIO_BLOQUEAR)
    @Operation(summary = "Bloquear usuario", description = "Bloquea a un usuario para impedir mensajeria directa con el usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario bloqueado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> bloquearUsuario(@PathVariable("bloqueadoId") Long bloqueadoId) {
        usuarioService.bloquearUsuario(bloqueadoId);
        return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_USUARIO_BLOQUEADO));
    }

    @PostMapping(Constantes.USUARIO_DESBLOQUEAR)
    @Operation(summary = "Desbloquear usuario", description = "Revierte un bloqueo previo para permitir mensajeria de nuevo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario desbloqueado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> desbloquearUsuario(@PathVariable("bloqueadoId") Long bloqueadoId) {
        usuarioService.desbloquearUsuario(bloqueadoId);
        return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_USUARIO_DESBLOQUEADO));
    }

    @PostMapping(Constantes.RECUPERAR_PASSWORD_SOLICITAR)
    @Operation(summary = "Solicitar recuperacion de password", description = "Genera y envia un codigo temporal al correo del usuario.", security = {})
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Codigo enviado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "400", description = "Email invalido o no registrado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "500", description = "Error enviando correo", content = @Content(schema = @Schema(implementation = Map.class)))
    })
    public ResponseEntity<Map<String, String>> solicitarRecuperacion(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String email = payload.get(Constantes.KEY_EMAIL);
        httpRateLimitService.checkPasswordRecoveryRequest(request, email);
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_EMAIL_REQUERIDO));
        }

        if (!usuarioService.existePorEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_EMAIL_NO_REGISTRADO));
        }

        try {
            passwordResetService.generateAndSendResetCode(email);
            return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_CODIGO_ENVIADO));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_ERROR_ENVIANDO_CORREO));
        }
    }

    @PostMapping(Constantes.RECUPERAR_PASSWORD_VERIFICAR)
    @Operation(summary = "Verificar codigo y cambiar password", description = "Valida codigo de recuperacion y actualiza la password.", security = {})
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Password actualizada", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "400", description = "Codigo invalido o payload incompleto", content = @Content(schema = @Schema(implementation = Map.class)))
    })
    public ResponseEntity<Map<String, String>> verificarYCambiarPassword(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String email = payload.get(Constantes.KEY_EMAIL);
        String code = payload.get(Constantes.KEY_CODE);
        String newPassword = payload.get(Constantes.KEY_NEW_PASSWORD);
        httpRateLimitService.checkPasswordRecoveryVerify(request, email);

        if (email == null || code == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_FALTAN_DATOS_REQUERIDOS));
        }

        boolean isValid = passwordResetService.isCodeValid(email, code);
        if (!isValid) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_CODIGO_INVALIDO_O_EXPIRADO));
        }

        try {
            usuarioService.actualizarPasswordPorEmail(email, newPassword);
            passwordResetService.invalidateCode(email);
            return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_CONTRASENA_ACTUALIZADA));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, e.getMessage()));
        }
    }

    @GetMapping(Constantes.ADMIN_DASHBOARD_STATS)
    @Operation(summary = "Dashboard admin", description = "Devuelve metricas globales para panel administrativo.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Metricas obtenidas", content = @Content(schema = @Schema(implementation = DashboardStatsDTO.class))),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public DashboardStatsDTO getDashboardStats(
            @Parameter(description = "Zona horaria IANA opcional, por ejemplo America/Bogota")
            @RequestParam(value = "tz", required = false) String tz) {
        return usuarioService.getDashboardStats(tz);
    }

    @GetMapping(Constantes.ADMIN_RECIENTES)
    @Operation(summary = "Usuarios recientes", description = "Devuelve una pagina de usuarios creados recientemente.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Pagina obtenida"),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public Page<UsuarioDTO> listarRecientes(
            @Parameter(description = "Numero de pagina, inicia en 0") @RequestParam(value = "page", defaultValue = "0") int page,
            @Parameter(description = "Tamano de pagina") @RequestParam(value = "size", defaultValue = "10") int size) {
        return usuarioService.listarRecientes(page, size);
    }

    @PutMapping(Constantes.USUARIO_PERFIL)
    @Operation(summary = "Actualizar perfil", description = "Actualiza datos visibles del perfil del usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Perfil actualizado", content = @Content(schema = @Schema(implementation = UsuarioDTO.class))),
            @ApiResponse(responseCode = "400", description = "Datos invalidos", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public UsuarioDTO actualizarPerfil(@RequestBody ActualizarPerfilDTO dto) {
        return usuarioService.actualizarPerfil(dto);
    }

    @PostMapping(Constantes.USUARIO_PERFIL_PASSWORD_CODE)
    @Operation(summary = "Solicitar codigo para cambio de password", description = "Envia un codigo temporal al correo del usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Codigo enviado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "400", description = "Solicitud invalida", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "401", description = "Contrasena actual incorrecta", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> solicitarCodigoCambioPassword(@RequestBody PasswordChangeCodeRequestDTO dto) {
        if (dto == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_FALTAN_DATOS_REQUERIDOS));
        }
        try {
            usuarioService.solicitarCodigoCambioPassword(dto.getCurrentPassword(), dto.getNewPassword());
            return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_CODIGO_ENVIADO));
        } catch (PasswordIncorrectaException e) {
            return ResponseEntity.status(401).body(Map.of(Constantes.KEY_MENSAJE, e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(Constantes.KEY_MENSAJE, e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_ERROR_ENVIANDO_CORREO));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_ERROR_ENVIANDO_CORREO));
        }
    }

    @PostMapping(Constantes.USUARIO_PERFIL_PASSWORD_CHANGE)
    @Operation(summary = "Cambiar password con codigo", description = "Confirma el codigo enviado y establece una nueva password para el usuario autenticado.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Password actualizada", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "400", description = "Codigo invalido o password no valida", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> cambiarPasswordConCodigo(@RequestBody PasswordChangeConfirmDTO dto) {
        usuarioService.cambiarPasswordConCodigo(dto.getCode(), dto.getNewPassword());
        return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_CONTRASENA_ACTUALIZADA));
    }

    @PostMapping(Constantes.ADMIN_USUARIO_BAN)
    @Operation(summary = "Suspender usuario (admin)", description = "Inhabilita una cuenta e informa el motivo de la suspension.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario suspendido"),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<?> banear(
            @Parameter(description = "ID del usuario a suspender") @PathVariable("id") Long id,
            @Parameter(description = "Motivo visible de la suspension") @RequestParam(Constantes.KEY_MOTIVO) String motivo) {
        usuarioService.banearUsuario(id, motivo);
        return ResponseEntity.ok().build();
    }

    @PostMapping(Constantes.ADMIN_USUARIO_UNBAN)
    @Operation(summary = "Reactivar usuario (admin)", description = "Habilita nuevamente una cuenta suspendida.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario reactivado", content = @Content(schema = @Schema(implementation = Map.class))),
            @ApiResponse(responseCode = "403", description = "Solo administradores", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public ResponseEntity<Map<String, String>> desbanearUsuario(@PathVariable("id") Long id) {
        usuarioService.desbanearAdministrativamente(id);
        return ResponseEntity.ok(Map.of(Constantes.KEY_MENSAJE, Constantes.MSG_USUARIO_REACTIVADO));
    }
}
