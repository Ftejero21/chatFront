package com.chat.chat.Service.UsuarioService;

import com.chat.chat.DTO.E2EPrivateKeyBackupDTO;
import com.chat.chat.Entity.E2EPrivateKeyBackupEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Exceptions.SemanticApiException;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.E2EPrivateKeyBackupRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.SolicitudDesbaneoRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Security.CustomUserDetailsService;
import com.chat.chat.Security.JwtService;
import com.chat.chat.Service.AuthService.GoogleIdTokenValidatorService;
import com.chat.chat.Service.AuthService.PasswordChangeService;
import com.chat.chat.Service.EmailService.EmailService;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceImplE2EPrivateKeyBackupTest {

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
    private SolicitudDesbaneoRepository solicitudDesbaneoRepository;
    @Mock
    private E2EPrivateKeyBackupRepository e2EPrivateKeyBackupRepository;
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
    private GoogleIdTokenValidatorService googleIdTokenValidatorService;
    @Mock
    private AdminAuditCrypto adminAuditCrypto;

    @InjectMocks
    private UsuarioServiceImpl service;

    @Test
    void upsertE2EPrivateKeyBackup_creaNuevoBackup() {
        Long userId = 21L;
        E2EPrivateKeyBackupDTO request = payloadValido();

        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(usuario(userId)));
        when(e2EPrivateKeyBackupRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(e2EPrivateKeyBackupRepository.save(any(E2EPrivateKeyBackupEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.upsertE2EPrivateKeyBackup(userId, request);

        ArgumentCaptor<E2EPrivateKeyBackupEntity> captor = ArgumentCaptor.forClass(E2EPrivateKeyBackupEntity.class);
        verify(e2EPrivateKeyBackupRepository).save(captor.capture());
        E2EPrivateKeyBackupEntity saved = captor.getValue();
        assertEquals(userId, saved.getUserId());
        assertEquals("PBKDF2", saved.getKdf());
        assertEquals("SHA-256", saved.getKdfHash());
        assertNotNull(saved.getUpdatedAt());
    }

    @Test
    void getE2EPrivateKeyBackup_devuelve404ConCodigoEstableSiNoExiste() {
        Long userId = 33L;
        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(usuario(userId)));
        when(e2EPrivateKeyBackupRepository.findByUserId(userId)).thenReturn(Optional.empty());

        SemanticApiException ex = assertThrows(SemanticApiException.class, () -> service.getE2EPrivateKeyBackup(userId));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals(Constantes.ERR_E2E_BACKUP_NOT_FOUND, ex.getCode());
        assertFalse(ex.getTraceId() == null || ex.getTraceId().isBlank());
    }

    @Test
    void upsertE2EPrivateKeyBackup_rechazaSiNoEsSelfNiAdmin() {
        Long userId = 40L;
        when(securityUtils.getAuthenticatedUserId()).thenReturn(10L);
        when(securityUtils.hasRole(Constantes.ADMIN)).thenReturn(false);
        when(securityUtils.hasRole(Constantes.ROLE_ADMIN)).thenReturn(false);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(usuario(10L)));

        SemanticApiException ex = assertThrows(
                SemanticApiException.class,
                () -> service.upsertE2EPrivateKeyBackup(userId, payloadValido()));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals(Constantes.ERR_NO_AUTORIZADO, ex.getCode());
        verify(e2EPrivateKeyBackupRepository, never()).save(any(E2EPrivateKeyBackupEntity.class));
    }

    @Test
    void upsertE2EPrivateKeyBackup_rechazaPayloadInvalido() {
        Long userId = 55L;
        E2EPrivateKeyBackupDTO request = payloadValido();
        request.setKdf("SCRYPT");

        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepository.findFreshById(userId)).thenReturn(Optional.of(usuario(userId)));

        SemanticApiException ex = assertThrows(
                SemanticApiException.class,
                () -> service.upsertE2EPrivateKeyBackup(userId, request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals(Constantes.ERR_E2E_BACKUP_INVALID, ex.getCode());
        verify(e2EPrivateKeyBackupRepository, never()).save(any(E2EPrivateKeyBackupEntity.class));
    }

    private static E2EPrivateKeyBackupDTO payloadValido() {
        E2EPrivateKeyBackupDTO dto = new E2EPrivateKeyBackupDTO();
        dto.setEncryptedPrivateKey("encrypted-private-key");
        dto.setIv("iv-base64");
        dto.setSalt("salt-base64");
        dto.setKdf("PBKDF2");
        dto.setKdfHash("SHA-256");
        dto.setKdfIterations(310000);
        dto.setKeyLengthBits(256);
        dto.setPublicKey("PUBLIC_KEY_SAMPLE");
        dto.setPublicKeyFingerprint("sha256:abcd1234");
        return dto;
    }

    private static UsuarioEntity usuario(Long id) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setFechaCreacion(LocalDateTime.of(2026, 1, 1, 0, 0));
        return u;
    }
}
