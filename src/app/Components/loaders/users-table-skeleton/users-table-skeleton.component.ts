import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

type SkeletonVariant = 'users' | 'groups';

@Component({
  selector: 'app-users-table-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-table-skeleton.component.html',
  styleUrls: ['./users-table-skeleton.component.css'],
})
export class UsersTableSkeletonComponent {
  @Input() rowCount = 7;
  @Input() variant: SkeletonVariant = 'users';

  readonly userNameWidths = [110, 130, 72, 58, 58, 48, 44];
  readonly userEmailWidths = [160, 145, 175, 138, 120, 130, 110];
  readonly groupNameWidths = [140, 175, 128, 150, 120, 162, 136];
  readonly groupMetaWidths = [190, 145, 210, 170, 150, 165, 138];

  get rows(): number[] {
    return Array.from({ length: this.rowCount }, (_, i) => i);
  }

  get isUsersVariant(): boolean {
    return this.variant === 'users';
  }

  get titleWidth(): string {
    return this.isUsersVariant ? '160px' : '120px';
  }

  get showSearch(): boolean {
    return this.isUsersVariant;
  }

  get ariaLabel(): string {
    return this.isUsersVariant
      ? 'Cargando lista de usuarios...'
      : 'Cargando lista de grupos...';
  }

  get gridClass(): string {
    return this.isUsersVariant ? 'skeleton-grid-users' : 'skeleton-grid-groups';
  }

  get headerWidths(): string[] {
    return this.isUsersVariant
      ? ['60px', '44px', '28px', '58px']
      : ['76px', '64px', '52px', '36px', '58px'];
  }

  primaryWidth(i: number): string {
    const widths = this.isUsersVariant ? this.userNameWidths : this.groupNameWidths;
    return `${widths[i % widths.length]}px`;
  }

  secondaryWidth(i: number): string {
    const widths = this.isUsersVariant ? this.userEmailWidths : this.groupMetaWidths;
    return `${widths[i % widths.length]}px`;
  }
}
