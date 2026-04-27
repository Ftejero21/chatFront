import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

export type AiAskQuickAction = 'VERIFY' | 'SUGGEST_REPLY';

@Component({
  selector: 'app-ai-ask-popup',
  templateUrl: './ai-ask-popup.component.html',
  styleUrls: ['./ai-ask-popup.component.css'],
})
export class AiAskPopupComponent implements OnChanges {
  private readonly textareaMinHeightPx = 130;
  private readonly textareaMaxHeightPx = 520;

  @Input() open = false;
  @Input() referenceText = '';
  @Input() question = '';
  @Input() loading = false;
  @Input() result = '';
  @Input() error: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() questionChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();
  @Output() quickAction = new EventEmitter<AiAskQuickAction>();
  @ViewChild('aiAskTextarea')
  private aiAskTextareaRef?: ElementRef<HTMLTextAreaElement>;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['question']) {
      this.deferTextareaResize();
    }
  }

  public get normalizedQuestion(): string {
    return String(this.question || '').trim();
  }

  public get canSubmit(): boolean {
    return !this.loading && !!this.normalizedQuestion;
  }

  public get hasResult(): boolean {
    return !!String(this.result || '').trim();
  }

  public get resolvedReferenceText(): string {
    return String(this.referenceText || '').trim() || 'Texto del mensaje seleccionado...';
  }

  public onBackdropClick(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  public onClose(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  public onQuestionChange(next: string): void {
    this.questionChange.emit(String(next || ''));
  }

  public onTextareaInput(event: Event): void {
    const target = event?.target as HTMLTextAreaElement | null;
    if (!target) return;
    this.resizeTextarea(target);
  }

  public onSubmit(): void {
    if (!this.canSubmit) return;
    this.submitted.emit(this.normalizedQuestion);
  }

  public onQuickAction(action: AiAskQuickAction): void {
    if (this.loading) return;
    this.quickAction.emit(action);
  }

  private deferTextareaResize(): void {
    setTimeout(() => {
      const textarea = this.aiAskTextareaRef?.nativeElement;
      if (!textarea) return;
      this.resizeTextarea(textarea);
    }, 0);
  }

  private resizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const contentHeight = Number(textarea.scrollHeight || 0);
    const nextHeight = Math.max(
      this.textareaMinHeightPx,
      Math.min(contentHeight, this.textareaMaxHeightPx)
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      contentHeight > this.textareaMaxHeightPx ? 'auto' : 'hidden';
  }
}
