package com.chat.chat.Service.ChatService;

import com.chat.chat.DTO.ChatResumenDTO;
import com.chat.chat.Entity.ChatEntity;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.ChatIndividualEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.ChatIndividualRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.MessageType;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplAdminPreviewTest {

    @Mock
    private UsuarioRepository usuarioRepo;
    @Mock
    private ChatIndividualRepository chatIndRepo;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private ChatGrupalRepository chatGrupalRepo;
    @Mock
    private SecurityUtils securityUtils;

    @InjectMocks
    private ChatServiceImpl chatService;

    @Test
    void adminRecibeUltimoMensajeRawEnChatIndividual() {
        Long usuarioObjetivoId = 11L;
        Long adminId = 1L;

        UsuarioEntity admin = usuarioConRoles(adminId, Set.of("ROLE_ADMIN"));
        when(securityUtils.getAuthenticatedUserId()).thenReturn(adminId);
        when(usuarioRepo.findById(adminId)).thenReturn(Optional.of(admin));

        ChatIndividualEntity chat = chatIndividual(100L, "Ana", "Luis");
        when(chatIndRepo.findAllByUsuario1IdOrUsuario2Id(usuarioObjetivoId, usuarioObjetivoId)).thenReturn(List.of(chat));
        when(chatGrupalRepo.findAllByUsuariosId(usuarioObjetivoId)).thenReturn(List.of());
        MensajeEntity ultimo = mensaje(chat, usuario("Ana", "Perez"),
                "{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\",\"forAdmin\":\"ADMIN_RSA_B64\"}");
        when(mensajeRepository.countActivosByChatIds(anyList())).thenReturn(List.of(new Object[]{100L, 1L}));
        when(mensajeRepository.findLatestByChatIds(anyList())).thenReturn(List.of(ultimo));
        List<ChatResumenDTO> resultado = chatService.listarConversacionesDeUsuario(usuarioObjetivoId);

        assertEquals(1, resultado.size());
        assertEquals("{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\",\"forAdmin\":\"ADMIN_RSA_B64\"}",
                resultado.get(0).getUltimoMensaje());
        assertNull(resultado.get(0).getUltimoMensajeTexto());
        assertNull(resultado.get(0).getUltimoMensajePreview());
        assertNull(resultado.get(0).getUltimoMensajeDescifrado());
        assertEquals("TEXT", resultado.get(0).getUltimoMensajeTipo());
        assertEquals(1, resultado.get(0).getTotalMensajes());
    }

    @Test
    void adminRecibeUltimoMensajeRawEnChatGrupalConMetadatos() {
        Long usuarioObjetivoId = 11L;
        Long adminId = 1L;

        UsuarioEntity admin = usuarioConRoles(adminId, Set.of("ROLE_ADMIN"));
        when(securityUtils.getAuthenticatedUserId()).thenReturn(adminId);
        when(usuarioRepo.findById(adminId)).thenReturn(Optional.of(admin));

        when(chatIndRepo.findAllByUsuario1IdOrUsuario2Id(usuarioObjetivoId, usuarioObjetivoId)).thenReturn(List.of());

        ChatGrupalEntity grupal = new ChatGrupalEntity();
        grupal.setId(200L);
        grupal.setNombreGrupo("Equipo");
        when(chatGrupalRepo.findAllByUsuariosId(usuarioObjetivoId)).thenReturn(List.of(grupal));

        UsuarioEntity emisor = usuario("Irene", "Diaz");
        MensajeEntity ultimo = mensaje(grupal, emisor,
                "{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\",\"forAdmin\":\"ADMIN_RSA_B64\"}");
        when(mensajeRepository.countActivosByChatIds(anyList())).thenReturn(List.of(new Object[]{200L, 1L}));
        when(mensajeRepository.findLatestByChatIds(anyList())).thenReturn(List.of(ultimo));
        List<ChatResumenDTO> resultado = chatService.listarConversacionesDeUsuario(usuarioObjetivoId);

        assertEquals(1, resultado.size());
        assertEquals("{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\",\"forAdmin\":\"ADMIN_RSA_B64\"}",
                resultado.get(0).getUltimoMensaje());
        assertNull(resultado.get(0).getUltimoMensajeTexto());
        assertNull(resultado.get(0).getUltimoMensajePreview());
        assertNull(resultado.get(0).getUltimoMensajeDescifrado());
        assertEquals("Irene", resultado.get(0).getUltimoMensajeEmisorNombre());
        assertEquals("Diaz", resultado.get(0).getUltimoMensajeEmisorApellido());
        assertEquals("Irene Diaz", resultado.get(0).getUltimoMensajeEmisorNombreCompleto());
    }

    @Test
    void noAdminRecibeAccessDenied() {
        Long usuarioObjetivoId = 11L;
        Long userId = 2L;

        UsuarioEntity user = usuarioConRoles(userId, Set.of("ROLE_USER"));
        when(securityUtils.getAuthenticatedUserId()).thenReturn(userId);
        when(usuarioRepo.findById(userId)).thenReturn(Optional.of(user));

        assertThrows(AccessDeniedException.class, () -> chatService.listarConversacionesDeUsuario(usuarioObjetivoId));
    }

    @Test
    void e2eSinForAdminSeDevuelveRawSinDescifrar() {
        Long usuarioObjetivoId = 11L;
        Long adminId = 1L;

        UsuarioEntity admin = usuarioConRoles(adminId, Set.of("ROLE_ADMIN"));
        when(securityUtils.getAuthenticatedUserId()).thenReturn(adminId);
        when(usuarioRepo.findById(adminId)).thenReturn(Optional.of(admin));

        ChatIndividualEntity chat = chatIndividual(100L, "Ana", "Luis");
        when(chatIndRepo.findAllByUsuario1IdOrUsuario2Id(usuarioObjetivoId, usuarioObjetivoId)).thenReturn(List.of(chat));
        when(chatGrupalRepo.findAllByUsuariosId(usuarioObjetivoId)).thenReturn(List.of());
        MensajeEntity ultimo = mensaje(chat, usuario("Ana", "Perez"),
                "{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\"}");
        when(mensajeRepository.countActivosByChatIds(anyList())).thenReturn(List.of(new Object[]{100L, 1L}));
        when(mensajeRepository.findLatestByChatIds(anyList())).thenReturn(List.of(ultimo));

        List<ChatResumenDTO> resultado = chatService.listarConversacionesDeUsuario(usuarioObjetivoId);

        assertEquals(1, resultado.size());
        assertEquals("{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\"}",
                resultado.get(0).getUltimoMensaje());
        assertNull(resultado.get(0).getUltimoMensajeTexto());
        assertNull(resultado.get(0).getUltimoMensajePreview());
        assertNull(resultado.get(0).getUltimoMensajeDescifrado());
    }

    private static UsuarioEntity usuarioConRoles(Long id, Set<String> roles) {
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(id);
        usuario.setRoles(roles);
        return usuario;
    }

    private static ChatIndividualEntity chatIndividual(Long id, String nombre1, String nombre2) {
        ChatIndividualEntity chat = new ChatIndividualEntity();
        chat.setId(id);

        UsuarioEntity u1 = new UsuarioEntity();
        u1.setNombre(nombre1);
        UsuarioEntity u2 = new UsuarioEntity();
        u2.setNombre(nombre2);

        chat.setUsuario1(u1);
        chat.setUsuario2(u2);
        return chat;
    }

    private static UsuarioEntity usuario(String nombre, String apellido) {
        UsuarioEntity u = new UsuarioEntity();
        u.setNombre(nombre);
        u.setApellido(apellido);
        return u;
    }

    private static MensajeEntity mensaje(ChatEntity chat, UsuarioEntity emisor, String contenido) {
        MensajeEntity m = new MensajeEntity();
        m.setChat(chat);
        m.setEmisor(emisor);
        m.setContenido(contenido);
        m.setTipo(MessageType.TEXT);
        m.setActivo(true);
        m.setFechaEnvio(LocalDateTime.now());
        return m;
    }
}
