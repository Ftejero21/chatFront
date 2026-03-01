export interface DashboardStatsDTO {
  totalUsuarios: number;
  porcentajeUsuarios: number;
  porcentajeUsuariosHoy?: number;
  chatsActivos: number;
  porcentajeChats: number;
  chatsCreadosHoy?: number;
  porcentajeChatsHoy?: number;
  reportes: number;
  porcentajeReportes: number;
  reportesDiariosHoy?: number;
  porcentajeReportesHoy?: number;
  mensajesHoy: number;
  porcentajeMensajes: number;
  porcentajeMensajesHoy?: number;
}
