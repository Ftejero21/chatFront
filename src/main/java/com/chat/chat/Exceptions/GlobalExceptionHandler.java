package com.chat.chat.Exceptions;

import jakarta.servlet.http.HttpServletRequest;
import com.chat.chat.Utils.Constantes;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EmailNoRegistradoException.class)
    public ResponseEntity<ApiError> handleEmail(EmailNoRegistradoException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(Constantes.ERR_EMAIL_INVALIDO, ex.getMessage()));
    }

    @ExceptionHandler(PasswordIncorrectaException.class)
    public ResponseEntity<ApiError> handlePass(PasswordIncorrectaException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError(Constantes.ERR_PASSWORD_INCORRECTA, ex.getMessage()));
    }

    @ExceptionHandler(EmailYaExisteException.class)
    public ResponseEntity<Map<String, Object>> handleEmailDuplicado(EmailYaExisteException ex, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.CONFLICT.value());
        body.put("error", "CONFLICT");
        body.put("code", "EMAIL_YA_EXISTE");
        body.put("mensaje", ex.getMessage());
        body.put("path", request == null ? null : request.getRequestURI());
        body.put("timestamp", LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(UsuarioInactivoException.class)
    public ResponseEntity<ApiError> handleInactivo(UsuarioInactivoException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError(Constantes.ERR_USUARIO_INACTIVO, ex.getMessage()));
    }

    @ExceptionHandler(ReenvioInvalidoException.class)
    public ResponseEntity<ApiError> handleReenvioInvalido(ReenvioInvalidoException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(Constantes.ERR_REENVIO_INVALIDO, ex.getMessage()));
    }

    @ExceptionHandler(ReenvioNoAutorizadoException.class)
    public ResponseEntity<ApiError> handleReenvioNoAutorizado(ReenvioNoAutorizadoException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError(Constantes.ERR_REENVIO_NO_AUTORIZADO, ex.getMessage()));
    }

    @ExceptionHandler(RespuestaInvalidaException.class)
    public ResponseEntity<ApiError> handleRespuestaInvalida(RespuestaInvalidaException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(Constantes.ERR_RESPUESTA_INVALIDA, ex.getMessage()));
    }

    @ExceptionHandler(RespuestaNoAutorizadaException.class)
    public ResponseEntity<ApiError> handleRespuestaNoAutorizada(RespuestaNoAutorizadaException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError(Constantes.ERR_RESPUESTA_NO_AUTORIZADA, ex.getMessage()));
    }

    @ExceptionHandler(E2ERekeyConflictException.class)
    public ResponseEntity<ApiError> handleE2ERekeyConflict(E2ERekeyConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(E2EGroupValidationException.class)
    public ResponseEntity<ApiError> handleE2EGroupValidation(E2EGroupValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(UploadSecurityException.class)
    public ResponseEntity<ApiError> handleUploadSecurity(UploadSecurityException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError(Constantes.ERR_NO_AUTORIZADO, ex.getMessage()));
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<ApiError> handleNotFound(RecursoNoEncontradoException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(Constantes.ERR_NO_ENCONTRADO, ex.getMessage()));
    }

    @ExceptionHandler(ConflictoException.class)
    public ResponseEntity<ApiError> handleConflict(ConflictoException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(GoogleAuthException.class)
    public ResponseEntity<ApiError> handleGoogleAuth(GoogleAuthException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(new ApiError(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(SemanticApiException.class)
    public ResponseEntity<Map<String, Object>> handleSemanticApiException(SemanticApiException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", ex.getCode());
        body.put("message", ex.getMessage());
        body.put("traceId", ex.getTraceId());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(Constantes.ERR_RESPUESTA_INVALIDA, ex.getMessage()));
    }

    @ExceptionHandler(ValidacionPayloadException.class)
    public ResponseEntity<Map<String, Object>> handleValidacionPayload(ValidacionPayloadException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", Constantes.ERR_RESPUESTA_INVALIDA);
        body.put("message", ex.getMessage());
        body.put("detalleCampos", ex.getDetalleCampos());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(SqlInjectionException.class)
    public ResponseEntity<ApiError> handleSqlInjection(SqlInjectionException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(Constantes.ERR_SQL_INJECTION, ex.getMessage()));
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ApiError> handleTooManyRequests(TooManyRequestsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .body(new ApiError(Constantes.ERR_RATE_LIMIT, ex.getMessage()));
    }
}
