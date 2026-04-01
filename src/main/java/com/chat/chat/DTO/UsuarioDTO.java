package com.chat.chat.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Set;

public class UsuarioDTO {
    private Long id;
    private String nombre;
    private String apellido;
    private boolean activo;
    private String foto;
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    private Set<String> roles;
    private String publicKey;
    private Boolean hasPublicKey;
    private Set<Long> bloqueadosIds;
    private Set<Long> meHanBloqueadoIds;

    public Set<Long> getMeHanBloqueadoIds() {
        return meHanBloqueadoIds;
    }

    public void setMeHanBloqueadoIds(Set<Long> meHanBloqueadoIds) {
        this.meHanBloqueadoIds = meHanBloqueadoIds;
    }

    public String getFoto() {
        return foto;
    }

    public void setFoto(String foto) {
        this.foto = foto;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public Boolean getHasPublicKey() {
        return hasPublicKey;
    }

    public void setHasPublicKey(Boolean hasPublicKey) {
        this.hasPublicKey = hasPublicKey;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getApellido() {
        return apellido;
    }

    public void setApellido(String apellido) {
        this.apellido = apellido;
    }

    public boolean isActivo() {
        return activo;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }

    public Set<Long> getBloqueadosIds() {
        return bloqueadosIds;
    }

    public void setBloqueadosIds(Set<Long> bloqueadosIds) {
        this.bloqueadosIds = bloqueadosIds;
    }
}
