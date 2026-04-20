import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-scheduled-section',
  templateUrl: './admin-scheduled-section.component.html',
  styleUrls: ['./admin-scheduled-section.component.css'],
})
export class AdminScheduledSectionComponent {
  @Input() active: boolean = false;
  @Input() headerSubtitle: string = '';

  @Output() backRequested = new EventEmitter<void>();
}
