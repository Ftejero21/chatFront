package com.chat.chat.DTO;

public class DashboardStatsDTO {

    private long totalUsuarios;
    private double porcentajeUsuarios;
    private double porcentajeUsuariosHoy;

    private long chatsActivos;
    private long chatsCreadosHoy;
    private double porcentajeChats;
    private double porcentajeChatsHoy;

    private long reportes;
    private long reportesDiariosHoy;
    private double porcentajeReportes;
    private double porcentajeReportesHoy;

    private long mensajesHoy;
    private double porcentajeMensajes;
    private double porcentajeMensajesHoy;

    public DashboardStatsDTO() {
    }

    public DashboardStatsDTO(long totalUsuarios, double porcentajeUsuarios, long chatsActivos, double porcentajeChats,
            long reportes, double porcentajeReportes, long mensajesHoy, double porcentajeMensajes) {
        this.totalUsuarios = totalUsuarios;
        this.porcentajeUsuarios = porcentajeUsuarios;
        this.chatsActivos = chatsActivos;
        this.porcentajeChats = porcentajeChats;
        this.reportes = reportes;
        this.porcentajeReportes = porcentajeReportes;
        this.mensajesHoy = mensajesHoy;
        this.porcentajeMensajes = porcentajeMensajes;
    }

    public DashboardStatsDTO(
            long totalUsuarios,
            double porcentajeUsuarios,
            double porcentajeUsuariosHoy,
            long chatsActivos,
            long chatsCreadosHoy,
            double porcentajeChats,
            double porcentajeChatsHoy,
            long reportes,
            long reportesDiariosHoy,
            double porcentajeReportes,
            double porcentajeReportesHoy,
            long mensajesHoy,
            double porcentajeMensajes,
            double porcentajeMensajesHoy) {
        this.totalUsuarios = totalUsuarios;
        this.porcentajeUsuarios = porcentajeUsuarios;
        this.porcentajeUsuariosHoy = porcentajeUsuariosHoy;
        this.chatsActivos = chatsActivos;
        this.chatsCreadosHoy = chatsCreadosHoy;
        this.porcentajeChats = porcentajeChats;
        this.porcentajeChatsHoy = porcentajeChatsHoy;
        this.reportes = reportes;
        this.reportesDiariosHoy = reportesDiariosHoy;
        this.porcentajeReportes = porcentajeReportes;
        this.porcentajeReportesHoy = porcentajeReportesHoy;
        this.mensajesHoy = mensajesHoy;
        this.porcentajeMensajes = porcentajeMensajes;
        this.porcentajeMensajesHoy = porcentajeMensajesHoy;
    }

    public long getTotalUsuarios() {
        return totalUsuarios;
    }

    public void setTotalUsuarios(long totalUsuarios) {
        this.totalUsuarios = totalUsuarios;
    }

    public double getPorcentajeUsuarios() {
        return porcentajeUsuarios;
    }

    public void setPorcentajeUsuarios(double porcentajeUsuarios) {
        this.porcentajeUsuarios = porcentajeUsuarios;
    }

    public double getPorcentajeUsuariosHoy() {
        return porcentajeUsuariosHoy;
    }

    public void setPorcentajeUsuariosHoy(double porcentajeUsuariosHoy) {
        this.porcentajeUsuariosHoy = porcentajeUsuariosHoy;
    }

    public long getChatsActivos() {
        return chatsActivos;
    }

    public void setChatsActivos(long chatsActivos) {
        this.chatsActivos = chatsActivos;
    }

    public long getChatsCreadosHoy() {
        return chatsCreadosHoy;
    }

    public void setChatsCreadosHoy(long chatsCreadosHoy) {
        this.chatsCreadosHoy = chatsCreadosHoy;
    }

    public double getPorcentajeChats() {
        return porcentajeChats;
    }

    public void setPorcentajeChats(double porcentajeChats) {
        this.porcentajeChats = porcentajeChats;
    }

    public double getPorcentajeChatsHoy() {
        return porcentajeChatsHoy;
    }

    public void setPorcentajeChatsHoy(double porcentajeChatsHoy) {
        this.porcentajeChatsHoy = porcentajeChatsHoy;
    }

    public long getReportes() {
        return reportes;
    }

    public void setReportes(long reportes) {
        this.reportes = reportes;
    }

    public long getReportesDiariosHoy() {
        return reportesDiariosHoy;
    }

    public void setReportesDiariosHoy(long reportesDiariosHoy) {
        this.reportesDiariosHoy = reportesDiariosHoy;
    }

    public double getPorcentajeReportes() {
        return porcentajeReportes;
    }

    public void setPorcentajeReportes(double porcentajeReportes) {
        this.porcentajeReportes = porcentajeReportes;
    }

    public double getPorcentajeReportesHoy() {
        return porcentajeReportesHoy;
    }

    public void setPorcentajeReportesHoy(double porcentajeReportesHoy) {
        this.porcentajeReportesHoy = porcentajeReportesHoy;
    }

    public long getMensajesHoy() {
        return mensajesHoy;
    }

    public void setMensajesHoy(long mensajesHoy) {
        this.mensajesHoy = mensajesHoy;
    }

    public double getPorcentajeMensajes() {
        return porcentajeMensajes;
    }

    public void setPorcentajeMensajes(double porcentajeMensajes) {
        this.porcentajeMensajes = porcentajeMensajes;
    }

    public double getPorcentajeMensajesHoy() {
        return porcentajeMensajesHoy;
    }

    public void setPorcentajeMensajesHoy(double porcentajeMensajesHoy) {
        this.porcentajeMensajesHoy = porcentajeMensajesHoy;
    }
}
