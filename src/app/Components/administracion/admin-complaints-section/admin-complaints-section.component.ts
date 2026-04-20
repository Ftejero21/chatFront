import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserComplaintDTO } from '../../../Interface/UserComplaintDTO';

@Component({
  selector: 'app-admin-complaints-section',
  templateUrl: './admin-complaints-section.component.html',
  styleUrls: ['./admin-complaints-section.component.css'],
})
export class AdminComplaintsSectionComponent {
  @Input() active: boolean = false;
  @Input() headerSubtitle: string = '';
  @Input() loadingComplaints: boolean = false;
  @Input() complaintsItems: UserComplaintDTO[] = [];
  @Input() complaintsEmptyText: string = '';
  @Input() complaintsPage: number = 0;
  @Input() complaintsTotalPages: number = 1;
  @Input() complaintsIsLastPage: boolean = true;
  @Input() complaintsTotalElements: number = 0;

  @Output() backRequested = new EventEmitter<void>();
  @Output() complaintClicked = new EventEmitter<UserComplaintDTO>();
  @Output() userNameClicked = new EventEmitter<{ userId: number; name: string }>();
  @Output() prevPageRequested = new EventEmitter<void>();
  @Output() nextPageRequested = new EventEmitter<void>();

  public getComplaintReporterLabel(item: UserComplaintDTO): string {
    const label = String(item?.denuncianteNombre || '').trim();
    if (label) return label;
    const userId = Number(item?.denuncianteId || 0);
    return userId > 0 ? `Usuario #${userId}` : 'Usuario desconocido';
  }

  public getComplaintTargetLabel(item: UserComplaintDTO): string {
    const label = String(item?.denunciadoNombre || '').trim();
    if (label) return label;
    const userId = Number(item?.denunciadoId || 0);
    return userId > 0 ? `Usuario #${userId}` : 'Usuario desconocido';
  }

  public onReporterNameClick(item: UserComplaintDTO, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const userId = Number(item?.denuncianteId || 0);
    if (!Number.isFinite(userId) || userId <= 0) return;
    this.userNameClicked.emit({
      userId,
      name: this.getComplaintReporterLabel(item),
    });
  }

  public onTargetNameClick(item: UserComplaintDTO, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const userId = Number(item?.denunciadoId || 0);
    if (!Number.isFinite(userId) || userId <= 0) return;
    this.userNameClicked.emit({
      userId,
      name: this.getComplaintTargetLabel(item),
    });
  }
}
