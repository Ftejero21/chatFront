import { Component, EventEmitter, HostListener, Output } from '@angular/core';

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
export class PollComposerComponent {
  @Output() public close = new EventEmitter<void>();
  @Output() public submitPoll = new EventEmitter<PollDraftPayload>();

  public pregunta = '';
  public permitirMultiples = true;
  public opciones: PollOptionDraft[] = [];
  public draggingOptionId: number | null = null;
  public emojiTarget: PollEmojiTarget | null = null;

  private nextOptionId = 1;
  private readonly maxOpciones = 10;

  constructor() {
    this.opciones = [this.createOption(''), this.createOption('')];
  }

  public trackOption = (_: number, option: PollOptionDraft) => option.id;

  public get canSubmit(): boolean {
    return this.getPreguntaNormalizada().length > 0 && this.getOpcionesValidas().length >= 2;
  }

  public onClose(): void {
    this.close.emit();
  }

  public onOptionInput(): void {
    this.normalizeOptionRows();
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
      this.pregunta = `${this.pregunta || ''}${safeEmoji}`;
      return;
    }

    const option = this.opciones.find((item) => item.id === target.optionId);
    if (!option) {
      this.closeEmojiPicker();
      return;
    }
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
