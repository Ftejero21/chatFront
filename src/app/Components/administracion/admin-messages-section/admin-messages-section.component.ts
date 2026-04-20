import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UsuarioDTO } from '../../../Interface/UsuarioDTO';
import { AdminMessageComposerSubmitEvent } from '../admin-message-composer/admin-message-composer.component';

@Component({
  selector: 'app-admin-messages-section',
  templateUrl: './admin-messages-section.component.html',
  styleUrls: ['./admin-messages-section.component.css'],
})
export class AdminMessagesSectionComponent {
  @Input() active: boolean = false;
  @Input() headerSubtitle: string = '';
  @Input() users: UsuarioDTO[] = [];
  @Input() totalUsers: number = 0;
  @Input() sending: boolean = false;
  @Input() resetSignal: number = 0;
  @Input() hasMoreUsers: boolean = false;
  @Input() loadingMoreUsers: boolean = false;

  @Output() backRequested = new EventEmitter<void>();
  @Output() sendRequested = new EventEmitter<AdminMessageComposerSubmitEvent>();
  @Output() scheduleRequested = new EventEmitter<AdminMessageComposerSubmitEvent>();
  @Output() loadMoreRequested = new EventEmitter<void>();
}
