import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AiTextMode } from '../../../Interface/AiTextMode';
import { MensajeriaService } from '../../../Service/mensajeria/mensajeria.service';

type AiTextAssistantUsage = 'MENSAJE' | 'EMAIL' | 'PROGRAMAR_MENSAJE' | 'GENERICO';

@Component({
  selector: 'app-ai-text-assistant-popup',
  templateUrl: './ai-text-assistant-popup.component.html',
  styleUrls: ['./ai-text-assistant-popup.component.css'],
})
export class AiTextAssistantPopupComponent implements OnChanges {
  public readonly aiTextMode = AiTextMode;
  @Input() public visible = false;
  @Input() public titulo = 'Asistente IA';
  @Input() public descripcion = 'Pon con tus palabras lo que quieres generar o mejorar.';
  @Input() public placeholder = 'Escribe aqui tu idea...';
  @Input() public textoInicial = '';
  @Input() public tipoUso: AiTextAssistantUsage = 'GENERICO';
  @Input() public mostrarOpcionesRapidas = true;

  @Output() public cerrar = new EventEmitter<void>();
  @Output() public usarTexto = new EventEmitter<string>();
  @Output() public usarEmail = new EventEmitter<{ asunto: string; cuerpo: string }>();

  public textoIa = '';
  public resultadoIa = '';
  public cargandoIa = false;
  public errorIa = '';
  public modoSeleccionado: AiTextMode | null = null;

  public constructor(private readonly mensajeriaService: MensajeriaService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (this.visible) {
        this.textoIa = String(this.textoInicial || '').trim();
        this.resultadoIa = '';
        this.errorIa = '';
        this.cargandoIa = false;
        this.modoSeleccionado = null;
      } else {
        this.resetState();
      }
    }
  }

  public get canRunActions(): boolean {
    return !!String(this.textoIa || '').trim() && !this.cargandoIa;
  }

  public get canUseResult(): boolean {
    return !!String(this.resultadoIa || '').trim() && !this.cargandoIa;
  }

  public onClose(): void {
    if (this.cargandoIa) return;
    this.resetState();
    this.cerrar.emit();
  }

  public async procesarTexto(modo: AiTextMode): Promise<void> {
    const texto = String(this.textoIa || '').trim();
    if (!texto || this.cargandoIa) return;

    this.cargandoIa = true;
    this.errorIa = '';
    this.resultadoIa = '';
    this.modoSeleccionado = modo;

    try {
      const response = await firstValueFrom(
        this.mensajeriaService.procesarTextoConIa({ texto, modo })
      );
      if (response?.success) {
        this.resultadoIa = String(response?.textoGenerado || '').trim();
      } else {
        this.errorIa =
          String(response?.mensaje || '').trim() || 'No se pudo procesar el texto.';
      }
    } catch (err: any) {
      this.errorIa = String(
        err?.error?.mensaje || err?.error?.message || err?.message || ''
      ).trim() || 'No se pudo procesar el texto con IA.';
    } finally {
      this.cargandoIa = false;
    }
  }

  public onUseResult(): void {
    const result = String(this.resultadoIa || '').trim();
    if (!result) return;

    if (this.tipoUso === 'EMAIL') {
      const parsed = this.parseEmail(result);
      if (parsed.asunto || parsed.cuerpo) {
        this.usarEmail.emit(parsed);
      } else {
        this.usarTexto.emit(result);
      }
    } else {
      this.usarTexto.emit(result);
    }

    this.resetState();
    this.cerrar.emit();
  }

  private parseEmail(textoGenerado: string): { asunto: string; cuerpo: string } {
    const raw = String(textoGenerado || '').trim();
    const asuntoMatch = raw.match(/ASUNTO:\s*([^\n\r]+)/i);
    const cuerpoMatch = raw.match(/CUERPO:\s*([\s\S]*)$/i);
    return {
      asunto: String(asuntoMatch?.[1] || '').trim(),
      cuerpo: String(cuerpoMatch?.[1] || '').trim(),
    };
  }

  private resetState(): void {
    this.textoIa = '';
    this.resultadoIa = '';
    this.errorIa = '';
    this.cargandoIa = false;
    this.modoSeleccionado = null;
  }
}
