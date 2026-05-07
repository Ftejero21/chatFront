import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AiPollDraftContextMessageDTO, AiPollDraftRequestDTO } from '../../../Interface/AiPollDraftRequestDTO';
import { AiPollDraftResponseDTO } from '../../../Interface/AiPollDraftResponseDTO';
import { AiService } from '../../../Service/ai/ai.service';

interface PollOptionDraft {
  id: number;
  text: string;
}

export interface PollDraftPayload {
  pregunta: string;
  opciones: string[];
  permitirMultiples: boolean;
}

type PollEmojiTarget =
  | { type: 'pregunta' }
  | { type: 'opcion'; optionId: number };

@Component({
  selector: 'app-poll-composer',
  templateUrl: './poll-composer.component.html',
  styleUrl: './poll-composer.component.css',
})
export class PollComposerComponent implements OnChanges, OnDestroy {
  @Input() public chatGrupalId: number | null = null;
  @Input() public mensajesContextoIa: AiPollDraftContextMessageDTO[] = [];
  @Input() public usuarioActualId: number | null = null;
  @Input() public autogenerarEncuestaIa = false;
  @Output() public close = new EventEmitter<void>();
  @Output() public submitPoll = new EventEmitter<PollDraftPayload>();

  public pregunta = '';
  public permitirMultiples = true;
  public opciones: PollOptionDraft[] = [];
  public draggingOptionId: number | null = null;
  public emojiTarget: PollEmojiTarget | null = null;
  public encuestaIaGenerando = false;
  public encuestaIaError = '';

  private nextOptionId = 1;
  private readonly maxOpciones = 10;
  private readonly maxOpcionesIa = 4;
  private encuestaIaSolicitada = false;
  private encuestaIaRequestSub?: Subscription;
  private userHasEditedSinceIaRequest = false;
  private hasAppliedIaDraft = false;

  constructor(private aiService: AiService) {
    this.opciones = [this.createOption(''), this.createOption('')];
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const shouldRearm =
      !!changes['chatGrupalId'] ||
      !!changes['autogenerarEncuestaIa'];

    if (shouldRearm) {
      this.rearmAutoDraftIfNeeded();
    }

    if (this.shouldAutoGeneratePollDraft()) {
      this.requestPollDraftFromIa();
    }
  }

  public ngOnDestroy(): void {
    this.encuestaIaRequestSub?.unsubscribe();
  }

  public trackOption = (_: number, option: PollOptionDraft) => option.id;

  public get canSubmit(): boolean {
    return this.getPreguntaNormalizada().length > 0 && this.getOpcionesValidas().length >= 2;
  }

  public onClose(): void {
    this.close.emit();
  }

  public onQuestionInput(): void {
    this.markManualEdit();
  }

  public onOptionInput(): void {
    this.markManualEdit();
    this.normalizeOptionRows();
  }

  public onAllowMultipleChange(): void {
    this.markManualEdit();
  }

  public removeOption(optionId: number): void {
    const index = this.opciones.findIndex((option) => option.id === optionId);
    if (index < 0) return;
    if (this.opciones.length <= 2) {
      this.opciones[index].text = '';
      this.normalizeOptionRows();
      return;
    }
    this.opciones.splice(index, 1);
    if (this.isEmojiOpenForOption(optionId)) {
      this.closeEmojiPicker();
    }
    this.normalizeOptionRows();
  }

  public onOptionDragStart(option: PollOptionDraft, event: DragEvent): void {
    this.draggingOptionId = option.id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(option.id));
    }
  }

  public onOptionDragOver(target: PollOptionDraft, event: DragEvent): void {
    event.preventDefault();
    const fromIndex = this.opciones.findIndex(
      (option) => option.id === this.draggingOptionId
    );
    const toIndex = this.opciones.findIndex((option) => option.id === target.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [moved] = this.opciones.splice(fromIndex, 1);
    this.opciones.splice(toIndex, 0, moved);
  }

  public onOptionDragEnd(): void {
    this.draggingOptionId = null;
    this.normalizeOptionRows();
  }

  public submit(): void {
    if (!this.canSubmit) return;
    this.submitPoll.emit({
      pregunta: this.getPreguntaNormalizada(),
      opciones: this.getOpcionesValidas(),
      permitirMultiples: this.permitirMultiples === true,
    });
  }

  public toggleEmojiForQuestion(event: MouseEvent): void {
    event.stopPropagation();
    if (this.emojiTarget?.type === 'pregunta') {
      this.closeEmojiPicker();
      return;
    }
    this.emojiTarget = { type: 'pregunta' };
  }

  public toggleEmojiForOption(optionId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.emojiTarget?.type === 'opcion' && this.emojiTarget.optionId === optionId) {
      this.closeEmojiPicker();
      return;
    }
    this.emojiTarget = { type: 'opcion', optionId };
  }

  public onEmojiSelected(emoji: string): void {
    const safeEmoji = String(emoji || '').trim();
    const target = this.emojiTarget;
    if (!safeEmoji || !target) return;

    if (target.type === 'pregunta') {
      this.markManualEdit();
      this.pregunta = `${this.pregunta || ''}${safeEmoji}`;
      return;
    }

    const option = this.opciones.find((item) => item.id === target.optionId);
    if (!option) {
      this.closeEmojiPicker();
      return;
    }
    this.markManualEdit();
    option.text = `${option.text || ''}${safeEmoji}`;
    this.onOptionInput();
  }

  public isEmojiOpenForQuestion(): boolean {
    return this.emojiTarget?.type === 'pregunta';
  }

  public isEmojiOpenForOption(optionId: number): boolean {
    return this.emojiTarget?.type === 'opcion' && this.emojiTarget.optionId === optionId;
  }

  public closeEmojiPicker(): void {
    this.emojiTarget = null;
  }

  private requestPollDraftFromIa(): void {
    if (!this.shouldAutoGeneratePollDraft()) return;
    if (this.encuestaIaSolicitada || this.encuestaIaGenerando) return;

    const request = this.buildPollDraftRequest();
    if (!request) {
      this.encuestaIaSolicitada = true;
      return;
    }

    this.encuestaIaSolicitada = true;
    this.encuestaIaGenerando = true;
    this.encuestaIaError = '';
    this.userHasEditedSinceIaRequest = false;
    this.encuestaIaRequestSub?.unsubscribe();
    this.encuestaIaRequestSub = this.aiService
      .generarBorradorEncuestaConIa(request)
      .subscribe({
        next: (response: AiPollDraftResponseDTO) => {
          this.encuestaIaGenerando = false;
          if (!response?.success) {
            this.encuestaIaError =
              String(response?.mensaje || '').trim() ||
              'No se pudo generar el borrador.';
            return;
          }
          if (this.userHasEditedSinceIaRequest) return;
          this.applyIaDraft(response);
        },
        error: (error: any) => {
          this.encuestaIaGenerando = false;
          this.encuestaIaError =
            String(error?.error?.mensaje || error?.error?.message || error?.message || '').trim() ||
            'No se pudo generar el borrador con IA.';
        },
      });
  }

  private buildPollDraftRequest(): AiPollDraftRequestDTO | null {
    const chatGrupalId = Number(this.chatGrupalId || 0);
    if (!Number.isFinite(chatGrupalId) || chatGrupalId <= 0) return null;

    const mensajesEncrypted = Array.isArray(this.mensajesContextoIa)
      ? this.mensajesContextoIa.filter(
          (item) => !!String(item?.encryptedPayload || '').trim()
        )
      : [];
    if (mensajesEncrypted.length === 0) return null;

    return {
      chatGrupalId: Math.round(chatGrupalId),
      mensajes: mensajesEncrypted,
      maxOpciones: this.maxOpcionesIa,
      estilo: 'NORMAL',
    };
  }

  private applyIaDraft(response: AiPollDraftResponseDTO): void {
    const pregunta = String(response?.pregunta || '').trim();
    const opciones = Array.isArray(response?.opciones)
      ? response.opciones
          .map((option) => String(option || '').trim())
          .filter((option) => !!option)
          .slice(0, this.maxOpciones)
      : [];

    if (!pregunta || opciones.length < 2) {
      this.encuestaIaError =
        String(response?.mensaje || '').trim() || 'La IA no devolvió una encuesta válida.';
      return;
    }

    this.pregunta = pregunta;
    this.permitirMultiples = response?.multipleRespuestas === true;
    this.opciones = opciones.map((text) => this.createOption(text));
    this.normalizeOptionRows();
    this.hasAppliedIaDraft = true;
    this.encuestaIaError = '';
  }

  private shouldAutoGeneratePollDraft(): boolean {
    return (
      this.autogenerarEncuestaIa === true &&
      !this.encuestaIaSolicitada &&
      !this.hasAppliedIaDraft
    );
  }

  private rearmAutoDraftIfNeeded(): void {
    this.encuestaIaRequestSub?.unsubscribe();
    this.encuestaIaRequestSub = undefined;
    this.encuestaIaSolicitada = false;
    this.encuestaIaGenerando = false;
    this.encuestaIaError = '';
    this.userHasEditedSinceIaRequest = false;
    this.hasAppliedIaDraft = false;
  }

  private markManualEdit(): void {
    if (this.encuestaIaGenerando) {
      this.userHasEditedSinceIaRequest = true;
    }
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    if (!this.emojiTarget) return;
    const targetEl = event?.target as Element | null;
    if (!targetEl) {
      this.closeEmojiPicker();
      return;
    }
    if (targetEl.closest('.poll-emoji-anchor') || targetEl.closest('.poll-emoji-pop')) {
      return;
    }
    this.closeEmojiPicker();
  }

  private getPreguntaNormalizada(): string {
    return String(this.pregunta || '').trim();
  }

  private getOpcionesValidas(): string[] {
    return (this.opciones || [])
      .map((option) => String(option?.text || '').trim())
      .filter((text) => !!text);
  }

  private createOption(text: string): PollOptionDraft {
    return {
      id: this.nextOptionId++,
      text,
    };
  }

  private normalizeOptionRows(): void {
    const nonEmpty = (this.opciones || [])
      .map((option) => ({
        id: option.id,
        text: String(option?.text || ''),
      }))
      .filter((option) => option.text.trim().length > 0)
      .slice(0, this.maxOpciones);

    this.opciones = [...nonEmpty];
    while (this.opciones.length < 2) {
      this.opciones.push(this.createOption(''));
    }

    const hasTrailingBlank =
      this.opciones.length > 0 &&
      !String(this.opciones[this.opciones.length - 1]?.text || '').trim();
    if (!hasTrailingBlank && this.opciones.length < this.maxOpciones) {
      this.opciones.push(this.createOption(''));
    }

    const target = this.emojiTarget;
    if (target?.type === 'opcion' && !this.opciones.some((option) => option.id === target.optionId)) {
      this.closeEmojiPicker();
    }
  }
}
