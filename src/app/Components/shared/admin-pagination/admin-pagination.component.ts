import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-pagination.component.html',
  styleUrls: ['./admin-pagination.component.css'],
})
export class AdminPaginationComponent {
  @Input() currentPage = 0;
  @Input() totalPages = 1;
  @Input() totalElements = 0;
  @Input() itemLabel = 'elementos';
  @Input() loading = false;
  @Input() isLastPage = true;

  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  onPrevious(): void {
    if (this.loading || this.currentPage <= 0) return;
    this.previous.emit();
  }

  onNext(): void {
    if (this.loading || this.isLastPage) return;
    this.next.emit();
  }
}
