import { Directive, ElementRef, Input } from '@angular/core';

@Directive({
  selector: '[appMediaStream]',
})
export class MediaStreamDirective {
  constructor(private el: ElementRef<HTMLVideoElement | HTMLAudioElement>) {}

  @Input() set appMediaStream(stream: MediaStream | null | undefined) {
    const mediaEl = this.el.nativeElement as HTMLVideoElement | HTMLAudioElement & { srcObject?: any };
    mediaEl.srcObject = stream ?? null;
    // Safari/iOS a veces requiere play() tras asignar
    setTimeout(() => (mediaEl as any).play?.().catch(() => {}), 0);
  }
}
