package com.chat.chat.Service.UsuarioService;

import com.chat.chat.DTO.UsuarioDTO;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceImplListarActivosTest {

    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private SecurityUtils securityUtils;

    @InjectMocks
    private UsuarioServiceImpl usuarioService;

    @Test
    void listarUsuariosActivos_excluyeRolesAdmin() {
        Long authId = 99L;
        when(securityUtils.getAuthenticatedUserId()).thenReturn(authId);

        UsuarioEntity user = usuario(1L, Set.of("USUARIO"));
        UsuarioEntity admin = usuario(2L, Set.of("ADMIN"));
        UsuarioEntity roleAdmin = usuario(3L, Set.of("ROLE_ADMIN"));
        UsuarioEntity adminLower = usuario(4L, Set.of("admin"));
        UsuarioEntity manager = usuario(5L, Set.of("MANAGER"));

        when(usuarioRepository.findByActivoTrueAndIdNot(authId))
                .thenReturn(List.of(user, admin, roleAdmin, adminLower, manager));

        List<UsuarioDTO> result = usuarioService.listarUsuariosActivos();

        List<Long> returnedIds = result.stream().map(UsuarioDTO::getId).collect(Collectors.toList());
        assertEquals(List.of(1L, 5L), returnedIds);
        verify(usuarioRepository).findByActivoTrueAndIdNot(authId);
    }

    @Test
    void listarUsuariosActivos_permiteUsuariosSinRoles() {
        Long authId = 10L;
        when(securityUtils.getAuthenticatedUserId()).thenReturn(authId);

        UsuarioEntity sinRoles = usuario(7L, null);
        when(usuarioRepository.findByActivoTrueAndIdNot(authId)).thenReturn(List.of(sinRoles));

        List<UsuarioDTO> result = usuarioService.listarUsuariosActivos();

        assertEquals(1, result.size());
        assertEquals(7L, result.get(0).getId());
        assertTrue(result.get(0).isActivo());
    }

    private static UsuarioEntity usuario(Long id, Set<String> roles) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setNombre("Nombre" + id);
        u.setApellido("Apellido" + id);
        u.setEmail("user" + id + "@test.com");
        u.setActivo(true);
        u.setRoles(roles);
        return u;
    }
}
