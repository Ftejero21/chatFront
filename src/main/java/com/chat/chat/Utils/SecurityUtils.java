package com.chat.chat.Utils;

import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
public class SecurityUtils {

    @Autowired
    private UsuarioRepository usuarioRepository;

    /**
     * Devuelve el ID del usuario actualmente autenticado (el que envió el JWT).
     * Útil para evitar Spoofing e IDOR, ya que la fuente de verdad es el Token, no
     * lo que mande el cliente.
     */
    public Long getAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }

        Object principal = authentication.getPrincipal();
        String username;

        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        } else {
            username = principal.toString();
        }
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            throw new AccessDeniedException(Constantes.ERR_NO_AUTORIZADO);
        }

        UsuarioEntity user = usuarioRepository.findByEmail(username)
                .orElseThrow(() -> new RuntimeException(Constantes.MSG_USUARIO_AUTENTICADO_NO_ENCONTRADO));

        return user.getId();
    }

    public boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }

        String target = role == null ? "" : role.trim();
        String targetRole = target.toUpperCase().startsWith(Constantes.ROLE_PREFIX)
                ? target
                : Constantes.ROLE_PREFIX + target;

        for (GrantedAuthority authority : auth.getAuthorities()) {
            if (authority == null || authority.getAuthority() == null) {
                continue;
            }
            String authRole = authority.getAuthority();
            if (authRole.equalsIgnoreCase(targetRole) || authRole.equalsIgnoreCase(target)) {
                return true;
            }
        }
        return false;
    }
}
