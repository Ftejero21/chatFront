package com.chat.chat.DTO;

import com.chat.chat.Utils.GroupVisibility;

import java.time.LocalDateTime;
import java.util.List;

public class GroupDetailDTO {
    private Long id;
    private String nombreGrupo;
    private String fotoGrupo;
    private String descripcion;
    private GroupVisibility visibilidad;
    private LocalDateTime fechaCreacion;
    private Long idCreador;
    private String nombreCreador;
    private int mediaCount;
    private int filesCount;
    private boolean canEditGroup;
    private List<GroupMemberDTO> miembros;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombreGrupo() {
        return nombreGrupo;
    }

    public void setNombreGrupo(String nombreGrupo) {
        this.nombreGrupo = nombreGrupo;
    }

    public String getFotoGrupo() {
        return fotoGrupo;
    }

    public void setFotoGrupo(String fotoGrupo) {
        this.fotoGrupo = fotoGrupo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public GroupVisibility getVisibilidad() {
        return visibilidad;
    }

    public void setVisibilidad(GroupVisibility visibilidad) {
        this.visibilidad = visibilidad;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public Long getIdCreador() {
        return idCreador;
    }

    public void setIdCreador(Long idCreador) {
        this.idCreador = idCreador;
    }

    public String getNombreCreador() {
        return nombreCreador;
    }

    public void setNombreCreador(String nombreCreador) {
        this.nombreCreador = nombreCreador;
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

    public boolean isCanEditGroup() {
        return canEditGroup;
    }

    public void setCanEditGroup(boolean canEditGroup) {
        this.canEditGroup = canEditGroup;
    }

    public List<GroupMemberDTO> getMiembros() {
        return miembros;
    }

    public void setMiembros(List<GroupMemberDTO> miembros) {
        this.miembros = miembros;
    }
}
