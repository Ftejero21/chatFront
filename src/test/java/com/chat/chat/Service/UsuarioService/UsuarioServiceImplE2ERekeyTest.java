package com.chat.chat.Service.UsuarioService;

import com.chat.chat.DTO.E2ERekeyRequestDTO;
import com.chat.chat.DTO.E2EStateDTO;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.E2ERekeyConflictException;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Security.CustomUserDetailsService;
import com.chat.chat.Security.JwtService;
import com.chat.chat.Service.AuthService.PasswordChangeService;
import com.chat.chat.Service.EmailService.EmailService;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceImplE2ERekeyTest {

    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private EmailService emailService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private ChatRepository chatRepository;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private JwtService jwtService;
    @Mock
    private CustomUserDetailsService customUserDetailsService;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private PasswordChangeService passwordChangeService;
    @Mock
    private AdminAuditCrypto adminAuditCrypto;

    @InjectMocks
    private UsuarioServiceImpl service;

    @Test
    void getE2EState_devuelveFingerprintYUpdatedAt() {
        Long userId = 11L;
        UsuarioEntity user = usuario(userId, "PUBLIC_KEY_11", "encoded", LocalDateTime.of(2026, 2, 20, 10, 0));

        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(user));

        E2EStateDTO state = service.getE2EState(userId);

        assertEquals(true, state.isHasPublicKey());
        assertEquals("02da0b77303b", state.getPublicKeyFingerprint());
        assertEquals(LocalDateTime.of(2026, 2, 20, 10, 0), state.getUpdatedAt());
    }

    @Test
    void rekey_conflictoSiExpectedOldFingerprintNoCoincide() {
        Long userId = 11L;
        UsuarioEntity requester = usuario(userId, "PUBLIC_KEY_11", "encoded", LocalDateTime.now());
        UsuarioEntity target = usuario(userId, "PUBLIC_KEY_11", "encoded", LocalDateTime.now());

        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findById(userId)).thenReturn(Optional.of(requester));
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(target));
        when(passwordEncoder.matches(eq("current-pass"), anyString())).thenReturn(true);

        E2ERekeyRequestDTO req = new E2ERekeyRequestDTO();
        req.setCurrentPassword("current-pass");
        req.setNewPublicKey("PUBLIC_KEY_11_NEW");
        req.setExpectedOldFingerprint("ffffffffffff");

        assertThrows(E2ERekeyConflictException.class, () -> service.rekeyE2E(userId, req));
        verify(usuarioRepository, never()).save(any(UsuarioEntity.class));
    }

    @Test
    void updatePublicKey_rechazaOverwriteAccidentalSiYaExisteDistinta() {
        Long userId = 11L;
        UsuarioEntity user = usuario(userId, "PUBLIC_KEY_11", "encoded", LocalDateTime.now());

        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(user));

        assertThrows(E2ERekeyConflictException.class, () -> service.updatePublicKey(userId, "PUBLIC_KEY_11_NEW"));
        verify(usuarioRepository, never()).save(any(UsuarioEntity.class));
    }

    private static UsuarioEntity usuario(Long id, String publicKey, String password, LocalDateTime keyUpdatedAt) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setPublicKey(publicKey);
        u.setPassword(password);
        u.setPublicKeyUpdatedAt(keyUpdatedAt);
        u.setFechaCreacion(LocalDateTime.of(2026, 1, 1, 0, 0));
        return u;
    }
}
