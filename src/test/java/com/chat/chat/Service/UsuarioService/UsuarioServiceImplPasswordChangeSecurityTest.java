package com.chat.chat.Service.UsuarioService;

import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.PasswordIncorrectaException;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Service.AuthService.PasswordChangeService;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceImplPasswordChangeSecurityTest {

    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private PasswordChangeService passwordChangeService;

    @InjectMocks
    private UsuarioServiceImpl service;

    @Test
    void solicitarCodigoCambioPassword_siPasswordActualIncorrecta_noGeneraNiEnviaCodigo() {
        UsuarioEntity usuario = usuario(10L, "HASH_123");
        when(securityUtils.getAuthenticatedUserId()).thenReturn(10L);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("1234", "HASH_123")).thenReturn(false);

        PasswordIncorrectaException ex = assertThrows(
                PasswordIncorrectaException.class,
                () -> service.solicitarCodigoCambioPassword("1234", "nuevaSegura"));

        assertEquals("La contraseña actual es incorrecta.", ex.getMessage());
        verify(passwordChangeService, never()).generateAndSendChangeCode(any(), any());
    }

    @Test
    void solicitarCodigoCambioPassword_siNuevaIgualActual_rechazaAntesDeGenerarCodigo() {
        UsuarioEntity usuario = usuario(10L, "HASH_123");
        when(securityUtils.getAuthenticatedUserId()).thenReturn(10L);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches(eq("123"), eq("HASH_123"))).thenReturn(true);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> service.solicitarCodigoCambioPassword("123", "123"));

        assertEquals("La nueva contraseña no puede ser igual a la actual.", ex.getMessage());
        verify(passwordChangeService, never()).generateAndSendChangeCode(any(), any());
    }

    @Test
    void cambiarPasswordConCodigo_siNuevaIgualActual_noActualizaNiInvalidaCodigo() {
        UsuarioEntity usuario = usuario(10L, "HASH_123");
        when(securityUtils.getAuthenticatedUserId()).thenReturn(10L);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(usuario));
        when(passwordChangeService.isCodeValid("user@test.com", "999111")).thenReturn(true);
        when(passwordEncoder.matches("123", "HASH_123")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> service.cambiarPasswordConCodigo("999111", "123"));

        assertEquals("La nueva contraseña no puede ser igual a la actual.", ex.getMessage());
        verify(usuarioRepository, never()).save(any(UsuarioEntity.class));
        verify(passwordChangeService, never()).invalidateCode(any());
    }

    private static UsuarioEntity usuario(Long id, String passwordHash) {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(id);
        usuario.setEmail("user@test.com");
        usuario.setPassword(passwordHash);
        return usuario;
    }
}
