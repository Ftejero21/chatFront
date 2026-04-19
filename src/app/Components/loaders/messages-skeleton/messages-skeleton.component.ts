import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface MessageSkeletonRow {
  side: 'left' | 'right';
  lines: number;
  lineWidths?: string[];
  showAvatar?: boolean;
  type?: 'text' | 'poll';
}

@Component({
  selector: 'app-messages-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './messages-skeleton.component.html',
  styleUrls: ['./messages-skeleton.component.css'],
})
export class MessagesSkeletonComponent {
  @Input() showHeader = true;
  @Input() showInputBar = true;

  public readonly rows: MessageSkeletonRow[] = [
    { side: 'left', lines: 1, lineWidths: ['120px'], showAvatar: true },
    { side: 'left', lines: 2, lineWidths: ['180px', '130px'], showAvatar: true },
    { side: 'right', lines: 1, lineWidths: ['95px'] },
    { side: 'left', lines: 1, lineWidths: ['70px'], showAvatar: false },
    { side: 'right', lines: 0, type: 'poll' },
    { side: 'right', lines: 1, lineWidths: ['55px'] },
  ];
}
