import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-chat-list-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-list-skeleton.component.html',
  styleUrls: ['./chat-list-skeleton.component.css'],
})
export class ChatListSkeletonComponent {
  @Input() itemCount = 7;

  public get items(): number[] {
    return Array.from({ length: this.itemCount }, (_, i) => i);
  }
}
