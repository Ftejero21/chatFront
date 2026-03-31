import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-video-call-overlay',
  templateUrl: './video-call-overlay.component.html',
  styleUrls: ['./video-call-overlay.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoCallOverlayComponent {
  @Input() hasRemoteVideoActive = false;
  @Input() remoteStream: MediaStream | null = null;
  @Input() localStream: MediaStream | null = null;
  @Input() peerAvatarUrl: string | null = null;
  @Input() peerDisplayName = 'La otra persona';
  @Input() callInfoMessage: string | null = null;
  @Input() callStatusClass:
    | 'is-ringing'
    | 'is-ended'
    | 'is-error'
    | 'is-success'
    | null = null;
  @Input() isMuted = false;
  @Input() camOff = false;
  @Input() hasLocalVideo = false;

  @Output() toggleMuteClick = new EventEmitter<void>();
  @Output() toggleCamClick = new EventEmitter<void>();
  @Output() hangClick = new EventEmitter<void>();

  public get statusMessage(): string {
    return this.callInfoMessage || 'LLAMANDO...';
  }

  public get showLocalVideoOffState(): boolean {
    return this.camOff || !this.hasLocalVideo;
  }
}
