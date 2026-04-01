package com.chat.chat.DTO;

public class GroupMetadataUpdateDTO {
    private String nombreGrupo;
    private String descripcion;
    private String fotoGrupo;

    public String getNombreGrupo() {
        return nombreGrupo;
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

    public String getFotoGrupo() {
        return fotoGrupo;
    }

    public void setFotoGrupo(String fotoGrupo) {
        this.fotoGrupo = fotoGrupo;
    }
}
