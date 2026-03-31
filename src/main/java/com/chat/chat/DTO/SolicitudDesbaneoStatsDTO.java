package com.chat.chat.DTO;

public class SolicitudDesbaneoStatsDTO {
    private long pendientes;
    private long enRevision;
    private long aprobadas;
    private long rechazadas;
    private long abiertas;
    private long hoyReportantesUnicos;
    private String fechaReferencia;
    private String timezone;

    public long getPendientes() {
        return pendientes;
    }

    public void setPendientes(long pendientes) {
        this.pendientes = pendientes;
    }

    public long getEnRevision() {
        return enRevision;
    }

    public void setEnRevision(long enRevision) {
        this.enRevision = enRevision;
    }

    public long getAprobadas() {
        return aprobadas;
    }

    public void setAprobadas(long aprobadas) {
        this.aprobadas = aprobadas;
    }

    public long getRechazadas() {
        return rechazadas;
    }

    public void setRechazadas(long rechazadas) {
        this.rechazadas = rechazadas;
    }

    public long getAbiertas() {
        return abiertas;
    }

    public void setAbiertas(long abiertas) {
        this.abiertas = abiertas;
    }

    public long getHoyReportantesUnicos() {
        return hoyReportantesUnicos;
    }

    public void setHoyReportantesUnicos(long hoyReportantesUnicos) {
        this.hoyReportantesUnicos = hoyReportantesUnicos;
    }

    public String getFechaReferencia() {
        return fechaReferencia;
    }

    public void setFechaReferencia(String fechaReferencia) {
        this.fechaReferencia = fechaReferencia;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }
}
