export interface PollVotesPanelVoter {
  userId: number;
  label: string;
  fullName: string;
  photoUrl: string | null;
  initials: string;
  votedAt: string | null;
  votedAtLabel: string;
  isCurrentUser: boolean;
}

export interface PollVotesPanelOption {
  id: string;
  text: string;
  count: number;
  voters: PollVotesPanelVoter[];
}

export interface PollVotesPanelData {
  messageId: number;
  question: string;
  statusText: string;
  allowMultiple: boolean;
  totalVotes: number;
  options: PollVotesPanelOption[];
}
