export interface AiReportAnalysisResponseDTO {
  success: boolean;
  codigo?: string | null;
  mensaje?: string | null;
  motivoSeleccionado?: string | null;
  descripcionDenuncia?: string | null;
  gravedad?: string | null;
  resumen?: string | null;
  accionSugerida?: string | null;
}
