package com.chat.chat.DTO;

import com.chat.chat.Utils.GroupRole;

public class GroupMemberDTO {
    private Long id;
    private String nombre;
    private String apellido;
    private String foto;
    private GroupRole rolGrupo;
    private String estado;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getFoto() {
        return foto;
    }

    public void setFoto(String foto) {
        this.foto = foto;
    }

    public GroupRole getRolGrupo() {
        return rolGrupo;
    }

    public void setRolGrupo(GroupRole rolGrupo) {
        this.rolGrupo = rolGrupo;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }
}
