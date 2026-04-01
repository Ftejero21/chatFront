package com.chat.chat.Entity;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "chats_grupales")
public class ChatGrupalEntity extends ChatEntity {

    private String nombreGrupo;

    @Column(length = 500)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private com.chat.chat.Utils.GroupVisibility visibilidad = com.chat.chat.Utils.GroupVisibility.PRIVADO;

    @ManyToOne
    @JoinColumn(name = "creador_id")
    private UsuarioEntity creador;

    @ManyToMany
    @JoinTable(
            name = "chat_grupal_usuarios",
            joinColumns = @JoinColumn(name = "chat_id"),
            inverseJoinColumns = @JoinColumn(name = "usuario_id")
    )
    private List<UsuarioEntity> usuarios = new ArrayList<>();

    @ManyToMany
    @JoinTable(
            name = "chat_grupal_admins",
            joinColumns = @JoinColumn(name = "chat_id"),
            inverseJoinColumns = @JoinColumn(name = "usuario_id")
    )
    private Set<UsuarioEntity> admins = new HashSet<>();

    @Column(name = "media_count", nullable = false)
    private int mediaCount = 0;

    @Column(name = "files_count", nullable = false)
    private int filesCount = 0;

    @Column(name = "foto_url", length = 512)
    private String fotoUrl;

    @Column(nullable = false)
    private boolean activo = true;

    public String getNombreGrupo() {
        return nombreGrupo;
    }

    public String getFotoUrl() {
        return fotoUrl;
    }

    public void setFotoUrl(String fotoUrl) {
        this.fotoUrl = fotoUrl;
    }

    public void setNombreGrupo(String nombreGrupo) {
        this.nombreGrupo = nombreGrupo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public com.chat.chat.Utils.GroupVisibility getVisibilidad() {
        return visibilidad;
    }

    public void setVisibilidad(com.chat.chat.Utils.GroupVisibility visibilidad) {
        this.visibilidad = visibilidad;
    }

    public UsuarioEntity getCreador() {
        return creador;
    }

    public void setCreador(UsuarioEntity creador) {
        this.creador = creador;
    }

    public List<UsuarioEntity> getUsuarios() {
        return usuarios;
    }

    public void setUsuarios(List<UsuarioEntity> usuarios) {
        this.usuarios = usuarios;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public Set<UsuarioEntity> getAdmins() {
        return admins;
    }

    public void setAdmins(Set<UsuarioEntity> admins) {
        this.admins = admins;
    }

    public int getMediaCount() {
        return mediaCount;
    }

    public void setMediaCount(int mediaCount) {
        this.mediaCount = mediaCount;
    }

    public int getFilesCount() {
        return filesCount;
    }

    public void setFilesCount(int filesCount) {
        this.filesCount = filesCount;
    }
}
