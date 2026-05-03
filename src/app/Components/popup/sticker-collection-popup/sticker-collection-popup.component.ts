import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-sticker-collection-popup',
  templateUrl: './sticker-collection-popup.component.html',
  styleUrls: ['./sticker-collection-popup.component.css'],
})
export class StickerCollectionPopupComponent {
  @Input() public open = false;
  @Input() public stickerSrc = '';
  @Input() public checking = false;
  @Input() public saving = false;
  @Input() public owned = false;
  @Input() public canDelete = false;

  @Output() public closed = new EventEmitter<void>();
  @Output() public addSticker = new EventEmitter<void>();
  @Output() public deleteSticker = new EventEmitter<void>();

  public onClose(): void {
    if (this.saving) return;
    this.closed.emit();
  }

  public onPrimaryAction(): void {
    if (this.checking || this.saving) return;
    if (this.owned) {
      if (this.canDelete) this.deleteSticker.emit();
      return;
    }
    this.addSticker.emit();
  }
}

