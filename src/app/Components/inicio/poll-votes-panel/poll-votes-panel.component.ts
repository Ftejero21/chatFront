import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  PollVotesPanelData,
  PollVotesPanelOption,
  PollVotesPanelVoter,
} from '../../../Interface/PollVotesPanel';

@Component({
  selector: 'app-poll-votes-panel',
  templateUrl: './poll-votes-panel.component.html',
  styleUrl: './poll-votes-panel.component.css',
})
export class PollVotesPanelComponent {
  @Input() public data: PollVotesPanelData | null = null;
  @Output() public closePanel = new EventEmitter<void>();

  public onClose(): void {
    this.closePanel.emit();
  }

  public trackOption(index: number, option: PollVotesPanelOption): string {
    return String(option?.id || index);
  }

  public trackVoter(index: number, voter: PollVotesPanelVoter): string {
    return `${voter.userId}-${voter.votedAt || ''}-${index}`;
  }
}
