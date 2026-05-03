import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

type EditorMode = 'move' | 'crop' | 'text' | 'draw';

interface Point {
  x: number;
  y: number;
}

interface TextLayer {
  id: string;
  text: string;
  x: number; // image-space
  y: number; // image-space
  size: number;
  color: string;
}

interface DrawStroke {
  color: string;
  size: number;
  points: Point[]; // image-space
}

export interface StickerEditorSaveEvent {
  file: File;
  nombre: string;
  mimeType: 'image/png' | 'image/webp';
}

@Component({
  selector: 'app-sticker-editor-panel',
  templateUrl: './sticker-editor-panel.component.html',
  styleUrl: './sticker-editor-panel.component.css',
})
export class StickerEditorPanelComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() public imageFile: File | null = null;
  @Input() public imageUrl: string | null = null;
  @Input() public initialName = '';
  @Input() public saving = false;

  @Output() public cancel = new EventEmitter<void>();
  @Output() public guardarStickerEditado = new EventEmitter<StickerEditorSaveEvent>();

  @ViewChild('editorCanvas')
  private editorCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('cropOverlayCanvas')
  private cropOverlayCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewWrap')
  private previewWrapRef?: ElementRef<HTMLDivElement>;

  public stickerName = '';
  public working = false;
  public mode: EditorMode = 'move';

  public zoom = 1;
  public rotation = 0;
  public offsetX = 0;
  public offsetY = 0;

  public textInput = '';
  public textSize = 42;
  public textColor = '#ffffff';

  public drawColor = '#ff3b30';
  public drawSize = 8;

  public keepTransparentBackground = true;
  public outputMimeType: 'image/png' | 'image/webp' = 'image/png';

  public cropSelecting = false;
  public cropPathPoints: Point[] = [];
  public cropPathClosed = false;

  private readonly outputSize = 512;
  private imageElement: HTMLImageElement | null = null;
  private imageSourceUrl: string | null = null;
  private revokeSourceUrlOnDestroy = false;

  private draggingImage = false;
  private draggingTextId: string | null = null;
  private draggingCrop = false;
  private lassoDrawing = false;
  private drawingActive = false;
  private dragLastCanvasPoint: Point | null = null;
  private pendingStroke: DrawStroke | null = null;

  private textLayers: TextLayer[] = [];
  private drawStrokes: DrawStroke[] = [];

  public ngAfterViewInit(): void {
    void this.loadIncomingImage();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialName']) {
      this.stickerName = String(this.initialName || '').slice(0, 60);
    }
    if (changes['imageFile'] || changes['imageUrl']) {
      void this.loadIncomingImage();
    }
  }

  public ngOnDestroy(): void {
    this.cleanupSourceUrl();
  }

  @HostListener('window:resize')
  public onWindowResize(): void {
    this.renderCanvas();
  }

  public setMode(mode: EditorMode): void {
    this.mode = mode;
    this.draggingImage = false;
    this.draggingTextId = null;
    this.draggingCrop = false;
    this.drawingActive = false;
  }

  public onNameInput(event: Event): void {
    this.stickerName = String((event.target as HTMLInputElement | null)?.value || '').slice(0, 60);
  }

  public zoomIn(): void {
    this.zoom = Math.min(5, this.zoom + 0.1);
    this.renderCanvas();
  }

  public zoomOut(): void {
    this.zoom = Math.max(0.2, this.zoom - 0.1);
    this.renderCanvas();
  }

  public rotateLeft(): void {
    this.rotation -= 90;
    this.renderCanvas();
  }

  public rotateRight(): void {
    this.rotation += 90;
    this.renderCanvas();
  }

  public addTextLayerAtCenter(): void {
    const text = String(this.textInput || '').trim();
    if (!text || !this.imageElement) return;
    this.textLayers.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      x: this.imageElement.naturalWidth / 2,
      y: this.imageElement.naturalHeight / 2,
      size: this.textSize,
      color: this.textColor,
    });
    this.renderCanvas();
  }

  public clearTexts(): void {
    this.textLayers = [];
    this.renderCanvas();
  }

  public undoDraw(): void {
    this.drawStrokes.pop();
    this.renderCanvas();
  }

  public clearDrawings(): void {
    this.drawStrokes = [];
    this.renderCanvas();
  }

  public resetCropSelection(): void {
    this.cropPathPoints = [];
    this.cropPathClosed = false;
    this.cropSelecting = false;
    this.renderCanvas();
  }

  public async applyCrop(): Promise<void> {
    if (!this.imageElement || this.cropPathPoints.length < 3) return;
    const editorCanvas = this.editorCanvasRef?.nativeElement;
    if (!editorCanvas) return;
    const imagePoints = this.cropPathPoints
      .map((p) => this.canvasToImage(p.x, p.y))
      .filter((p): p is Point => !!p)
      .map((p) => ({
        x: Math.max(0, Math.min(this.imageElement!.naturalWidth, p.x)),
        y: Math.max(0, Math.min(this.imageElement!.naturalHeight, p.y)),
      }));
    if (imagePoints.length < 3) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of imagePoints) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const sx = Math.max(0, Math.floor(minX));
    const sy = Math.max(0, Math.floor(minY));
    const sw = Math.max(1, Math.ceil(maxX - minX));
    const sh = Math.max(1, Math.ceil(maxY - minY));

    const tmp = document.createElement('canvas');
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;

    if (!this.keepTransparentBackground) {
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, tmp.width, tmp.height);
    }

    tctx.save();
    tctx.beginPath();
    for (let i = 0; i < imagePoints.length; i++) {
      const p = imagePoints[i];
      const x = p.x - sx;
      const y = p.y - sy;
      if (i === 0) tctx.moveTo(x, y);
      else tctx.lineTo(x, y);
    }
    tctx.closePath();
    tctx.clip();

    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(this.imageElement, -sx, -sy);

    this.drawStrokesForCrop(tctx, sx, sy);
    this.drawTextLayersForCrop(tctx, sx, sy);
    tctx.restore();

    const blob = await new Promise<Blob | null>((resolve) => tmp.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) return;

    const nextUrl = URL.createObjectURL(blob);
    const nextImage = await this.loadImageFromUrl(nextUrl);
    this.cleanupSourceUrl();
    this.imageSourceUrl = nextUrl;
    this.revokeSourceUrlOnDestroy = true;
    this.imageElement = nextImage;

    this.textLayers = [];
    this.drawStrokes = [];
    this.zoom = Math.max(this.outputSize / Math.max(sw, sh), 0.2);
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resetCropSelection();
    this.renderCanvas();
  }

  public onCanvasPointerDown(event: PointerEvent): void {
    if (this.mode === 'crop') return;
    if (!this.imageElement) return;
    const canvas = this.editorCanvasRef?.nativeElement;
    if (!canvas) return;

    const canvasPoint = this.toCanvasPoint(event, canvas);
    this.dragLastCanvasPoint = canvasPoint;
    canvas.setPointerCapture(event.pointerId);

    if (this.mode === 'draw') {
      const imagePoint = this.canvasToImage(canvasPoint.x, canvasPoint.y);
      if (!imagePoint) return;
      this.drawingActive = true;
      this.pendingStroke = {
        color: this.drawColor,
        size: this.drawSize,
        points: [imagePoint],
      };
      this.renderCanvas();
      return;
    }

    const textId = this.hitTextLayer(canvasPoint.x, canvasPoint.y);
    if (this.mode === 'text' && textId) {
      this.draggingTextId = textId;
      return;
    }

    if (this.mode === 'text' && !textId) {
      const imagePoint = this.canvasToImage(canvasPoint.x, canvasPoint.y);
      const text = String(this.textInput || '').trim();
      if (imagePoint && text) {
        this.textLayers.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text,
          x: imagePoint.x,
          y: imagePoint.y,
          size: this.textSize,
          color: this.textColor,
        });
        this.renderCanvas();
      }
      return;
    }

    this.draggingImage = true;
  }

  public onCanvasPointerMove(event: PointerEvent): void {
    if (this.mode === 'crop') return;
    const canvas = this.editorCanvasRef?.nativeElement;
    if (!canvas || !this.dragLastCanvasPoint) return;
    const current = this.toCanvasPoint(event, canvas);
    const dx = current.x - this.dragLastCanvasPoint.x;
    const dy = current.y - this.dragLastCanvasPoint.y;
    this.dragLastCanvasPoint = current;

    if (this.drawingActive && this.pendingStroke) {
      const imagePoint = this.canvasToImage(current.x, current.y);
      if (imagePoint) {
        this.pendingStroke.points.push(imagePoint);
        this.renderCanvas();
      }
      return;
    }

    if (this.draggingTextId) {
      const layer = this.textLayers.find((t) => t.id === this.draggingTextId);
      if (!layer || !this.imageElement) return;
      const nextCanvasX = this.imageToCanvas(layer.x, layer.y);
      if (!nextCanvasX) return;
      const moved = this.canvasToImage(nextCanvasX.x + dx, nextCanvasX.y + dy);
      if (!moved) return;
      layer.x = moved.x;
      layer.y = moved.y;
      this.renderCanvas();
      return;
    }

    if (this.draggingImage) {
      this.offsetX += dx * this.devicePixelRatio();
      this.offsetY += dy * this.devicePixelRatio();
      this.renderCanvas();
    }
  }

  public onCanvasPointerUp(event: PointerEvent): void {
    if (this.mode === 'crop') return;
    const canvas = this.editorCanvasRef?.nativeElement;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (this.pendingStroke && this.pendingStroke.points.length > 0) {
      this.drawStrokes.push(this.pendingStroke);
    }
    this.pendingStroke = null;
    this.draggingImage = false;
    this.draggingTextId = null;
    this.draggingCrop = false;
    this.drawingActive = false;
    this.dragLastCanvasPoint = null;
    this.renderCanvas();
  }

  public resetEditorState(): void {
    this.mode = 'move';
    this.zoom = 1;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.textInput = '';
    this.textSize = 42;
    this.textColor = '#ffffff';
    this.drawColor = '#ff3b30';
    this.drawSize = 8;
    this.outputMimeType = 'image/png';
    this.keepTransparentBackground = true;
    this.textLayers = [];
    this.drawStrokes = [];
    this.resetCropSelection();
    this.fitImageToSquare();
    this.stickerName = String(this.initialName || '').slice(0, 60);
    this.renderCanvas();
  }

  public async onGuardar(): Promise<void> {
    if (!this.imageElement || this.working || this.saving) return;
    this.working = true;
    try {
      const blob = await this.exportBlob();
      if (!blob) return;
      const safeName = (String(this.stickerName || '').trim() || 'sticker').slice(0, 60);
      const ext = this.outputMimeType === 'image/webp' ? 'webp' : 'png';
      const file = new File([blob], `${safeName}.${ext}`, { type: this.outputMimeType });
      this.guardarStickerEditado.emit({
        file,
        nombre: safeName,
        mimeType: this.outputMimeType,
      });
    } finally {
      this.working = false;
    }
  }

  public canSave(): boolean {
    return !!this.imageElement && !this.working && !this.saving;
  }

  public isModeActive(mode: EditorMode): boolean {
    return this.mode === mode;
  }

  public canvasCursor(): string {
    if (this.mode === 'draw') return 'crosshair';
    if (this.mode === 'crop') return 'crosshair';
    if (this.mode === 'text') return 'text';
    return 'grab';
  }

  private async loadIncomingImage(): Promise<void> {
    const source = this.resolveImageSource();
    this.cleanupSourceUrl();
    this.imageElement = null;
    if (!source) {
      this.renderCanvas();
      return;
    }
    this.imageSourceUrl = source.url;
    this.revokeSourceUrlOnDestroy = source.revokeOnDestroy;

    const img = await this.loadImageFromUrl(source.url);
    if (!img) {
      this.renderCanvas();
      return;
    }

    this.imageElement = img;
    this.stickerName = String(this.initialName || this.deriveNameFromFile(this.imageFile) || '').slice(0, 60);
    this.resetEditorState();
  }

  private async loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.src = url;
    return await new Promise<HTMLImageElement | null>((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

  private deriveNameFromFile(file: File | null): string {
    if (!file) return '';
    return String(file.name || '').replace(/\.[^.]+$/, '');
  }

  private resolveImageSource(): { url: string; revokeOnDestroy: boolean } | null {
    if (this.imageFile) {
      return { url: URL.createObjectURL(this.imageFile), revokeOnDestroy: true };
    }
    const safeUrl = String(this.imageUrl || '').trim();
    if (!safeUrl) return null;
    return { url: safeUrl, revokeOnDestroy: false };
  }

  private cleanupSourceUrl(): void {
    if (this.imageSourceUrl && this.revokeSourceUrlOnDestroy) {
      try {
        URL.revokeObjectURL(this.imageSourceUrl);
      } catch {}
    }
    this.imageSourceUrl = null;
    this.revokeSourceUrlOnDestroy = false;
  }

  private fitImageToSquare(): void {
    const img = this.imageElement;
    if (!img) return;
    const scaleCover = Math.max(this.outputSize / img.naturalWidth, this.outputSize / img.naturalHeight);
    this.zoom = Number.isFinite(scaleCover) && scaleCover > 0 ? scaleCover : 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  private renderCanvas(): void {
    const canvas = this.editorCanvasRef?.nativeElement;
    const overlayCanvas = this.cropOverlayCanvasRef?.nativeElement;
    const wrap = this.previewWrapRef?.nativeElement;
    if (!canvas || !overlayCanvas || !wrap) return;

    const side = Math.max(220, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth)));
    const ratio = this.devicePixelRatio();
    canvas.width = Math.max(1, Math.floor(side * ratio));
    canvas.height = Math.max(1, Math.floor(side * ratio));
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;
    overlayCanvas.width = Math.max(1, Math.floor(side * ratio));
    overlayCanvas.height = Math.max(1, Math.floor(side * ratio));
    overlayCanvas.style.width = `${side}px`;
    overlayCanvas.style.height = `${side}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.keepTransparentBackground) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      this.drawAlphaPattern(ctx, canvas.width, canvas.height);
    }

    if (!this.imageElement) return;
    this.drawImageLayer(ctx, canvas.width, canvas.height, this.imageElement);
    this.drawStrokesLayer(ctx);
    this.drawTextLayers(ctx);
    this.drawCropOverlay(overlayCanvas, canvas.width, canvas.height);
  }

  private drawImageLayer(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    image: HTMLImageElement
  ): void {
    ctx.save();
    ctx.translate(canvasW / 2 + this.offsetX, canvasH / 2 + this.offsetY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.zoom, this.zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  }

  private drawTextLayers(ctx: CanvasRenderingContext2D): void {
    for (const layer of this.textLayers) {
      const c = this.imageToCanvas(layer.x, layer.y);
      if (!c) continue;
      const fontSize = Math.max(12, Math.round(layer.size * this.imageToCanvasScale()));
      ctx.save();
      ctx.font = `700 ${fontSize}px Segoe UI, Roboto, sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(layer.text, c.x, c.y);
      ctx.fillText(layer.text, c.x, c.y);
      ctx.restore();
    }
  }

  private drawTextLayersForExport(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.imageElement) return;
    for (const layer of this.textLayers) {
      const c = this.imageToCanvasWithTransform(
        layer.x,
        layer.y,
        canvasW,
        canvasH,
        offsetX,
        offsetY
      );
      if (!c) continue;
      const fontSize = Math.max(12, Math.round(layer.size));
      ctx.save();
      ctx.font = `700 ${fontSize}px Segoe UI, Roboto, sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(layer.text, c.x, c.y);
      ctx.fillText(layer.text, c.x, c.y);
      ctx.restore();
    }
  }

  private drawStrokesLayer(ctx: CanvasRenderingContext2D): void {
    const all = [...this.drawStrokes, ...(this.pendingStroke ? [this.pendingStroke] : [])];
    for (const stroke of all) {
      if (stroke.points.length < 1) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, stroke.size * this.imageToCanvasScale());
      ctx.beginPath();
      stroke.points.forEach((p, idx) => {
        const c = this.imageToCanvas(p.x, p.y);
        if (!c) return;
        if (idx === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawStrokesForExport(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    offsetX: number,
    offsetY: number
  ): void {
    for (const stroke of this.drawStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, stroke.size);
      ctx.beginPath();
      stroke.points.forEach((p, idx) => {
        const c = this.imageToCanvasWithTransform(
          p.x,
          p.y,
          canvasW,
          canvasH,
          offsetX,
          offsetY
        );
        if (!c) return;
        if (idx === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCropOverlay(overlayCanvas: HTMLCanvasElement, w: number, h: number): void {
    const octx = overlayCanvas.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, w, h);
    if (this.mode !== 'crop' || this.cropPathPoints.length === 0) return;

    octx.save();
    octx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    octx.fillRect(0, 0, w, h);

    octx.beginPath();
    for (let i = 0; i < this.cropPathPoints.length; i++) {
      const p = this.cropPathPoints[i];
      if (i === 0) octx.moveTo(p.x, p.y);
      else octx.lineTo(p.x, p.y);
    }
    if (this.cropPathClosed) octx.closePath();
    octx.globalCompositeOperation = 'destination-out';
    octx.fill();
    octx.globalCompositeOperation = 'source-over';

    octx.strokeStyle = '#22c55e';
    octx.lineWidth = 2;
    octx.setLineDash([7, 5]);
    octx.stroke();
    octx.restore();
  }

  private drawAlphaPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const tile = 16;
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const dark = ((x / tile + y / tile) % 2) === 0;
        ctx.fillStyle = dark ? '#eef2f7' : '#f8fafc';
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  private hitTextLayer(canvasX: number, canvasY: number): string | null {
    const canvas = this.editorCanvasRef?.nativeElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    for (let i = this.textLayers.length - 1; i >= 0; i--) {
      const layer = this.textLayers[i];
      const c = this.imageToCanvas(layer.x, layer.y);
      if (!c) continue;
      const fontSize = Math.max(12, Math.round(layer.size * this.imageToCanvasScale()));
      ctx.font = `700 ${fontSize}px Segoe UI, Roboto, sans-serif`;
      const width = ctx.measureText(layer.text).width;
      const height = fontSize * 1.2;
      if (
        canvasX >= c.x - width / 2 &&
        canvasX <= c.x + width / 2 &&
        canvasY >= c.y - height / 2 &&
        canvasY <= c.y + height / 2
      ) {
        return layer.id;
      }
    }
    return null;
  }

  private toCanvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private imageToCanvas(imageX: number, imageY: number): Point | null {
    const canvas = this.editorCanvasRef?.nativeElement;
    const image = this.imageElement;
    if (!canvas || !image) return null;

    const cx = canvas.width / 2 + this.offsetX;
    const cy = canvas.height / 2 + this.offsetY;
    const theta = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const localX = (imageX - image.naturalWidth / 2) * this.zoom;
    const localY = (imageY - image.naturalHeight / 2) * this.zoom;
    return {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    };
  }

  private canvasToImage(canvasX: number, canvasY: number): Point | null {
    const canvas = this.editorCanvasRef?.nativeElement;
    const image = this.imageElement;
    if (!canvas || !image) return null;
    if (!this.zoom) return null;

    const cx = canvas.width / 2 + this.offsetX;
    const cy = canvas.height / 2 + this.offsetY;
    const theta = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const dx = canvasX - cx;
    const dy = canvasY - cy;
    const localX = (dx * cos + dy * sin) / this.zoom;
    const localY = (-dx * sin + dy * cos) / this.zoom;
    return {
      x: localX + image.naturalWidth / 2,
      y: localY + image.naturalHeight / 2,
    };
  }

  private imageToCanvasScale(): number {
    const canvas = this.editorCanvasRef?.nativeElement;
    if (!canvas) return 1;
    return canvas.width / this.outputSize;
  }

  private imageToCanvasWithTransform(
    imageX: number,
    imageY: number,
    canvasW: number,
    canvasH: number,
    offsetX: number,
    offsetY: number
  ): Point | null {
    const image = this.imageElement;
    if (!image) return null;
    const cx = canvasW / 2 + offsetX;
    const cy = canvasH / 2 + offsetY;
    const theta = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const localX = (imageX - image.naturalWidth / 2) * this.zoom;
    const localY = (imageY - image.naturalHeight / 2) * this.zoom;
    return {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    };
  }

  public onCropOverlayPointerDown(event: PointerEvent): void {
    if (this.mode !== 'crop') return;
    const canvas = this.cropOverlayCanvasRef?.nativeElement;
    if (!canvas) return;
    const point = this.toCanvasPoint(event, canvas);
    this.cropSelecting = true;
    this.cropPathClosed = false;
    this.lassoDrawing = true;
    this.cropPathPoints = [point];
    canvas.setPointerCapture(event.pointerId);
    this.renderCanvas();
  }

  public onCropOverlayPointerMove(event: PointerEvent): void {
    if (this.mode !== 'crop' || !this.lassoDrawing) return;
    const canvas = this.cropOverlayCanvasRef?.nativeElement;
    if (!canvas) return;
    const point = this.toCanvasPoint(event, canvas);
    this.cropPathPoints.push(point);
    this.renderCanvas();
  }

  public onCropOverlayPointerUp(event: PointerEvent): void {
    const canvas = this.cropOverlayCanvasRef?.nativeElement;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (this.mode !== 'crop' || !this.lassoDrawing) return;
    this.lassoDrawing = false;
    this.cropSelecting = false;
    this.cropPathClosed = this.cropPathPoints.length >= 3;
    this.renderCanvas();
  }

  private drawStrokesForCrop(
    ctx: CanvasRenderingContext2D,
    shiftX: number,
    shiftY: number
  ): void {
    for (const stroke of this.drawStrokes) {
      if (!stroke.points.length) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, stroke.size);
      ctx.beginPath();
      stroke.points.forEach((p, idx) => {
        const x = p.x - shiftX;
        const y = p.y - shiftY;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawTextLayersForCrop(
    ctx: CanvasRenderingContext2D,
    shiftX: number,
    shiftY: number
  ): void {
    for (const layer of this.textLayers) {
      const x = layer.x - shiftX;
      const y = layer.y - shiftY;
      const fontSize = Math.max(12, Math.round(layer.size));
      ctx.save();
      ctx.font = `700 ${fontSize}px Segoe UI, Roboto, sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(layer.text, x, y);
      ctx.fillText(layer.text, x, y);
      ctx.restore();
    }
  }

  private async exportBlob(): Promise<Blob | null> {
    if (!this.imageElement) return null;
    const out = document.createElement('canvas');
    out.width = this.outputSize;
    out.height = this.outputSize;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    if (!this.keepTransparentBackground) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
    }

    const previewCanvas = this.editorCanvasRef?.nativeElement;
    const previewWidth = Number(previewCanvas?.width || out.width) || out.width;
    const scaleToOutput = out.width / previewWidth;
    const exportOffsetX = this.offsetX * scaleToOutput;
    const exportOffsetY = this.offsetY * scaleToOutput;

    this.drawImageLayerWithOffset(
      ctx,
      out.width,
      out.height,
      this.imageElement,
      exportOffsetX,
      exportOffsetY
    );
    this.drawStrokesForExport(ctx, out.width, out.height, exportOffsetX, exportOffsetY);
    this.drawTextLayersForExport(ctx, out.width, out.height, exportOffsetX, exportOffsetY);

    const quality = this.outputMimeType === 'image/webp' ? 0.92 : undefined;
    return await new Promise<Blob | null>((resolve) => {
      out.toBlob((blob) => resolve(blob), this.outputMimeType, quality);
    });
  }

  private devicePixelRatio(): number {
    return Math.max(1, Number(window.devicePixelRatio) || 1);
  }

  private drawImageLayerWithOffset(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    image: HTMLImageElement,
    offsetX: number,
    offsetY: number
  ): void {
    ctx.save();
    ctx.translate(canvasW / 2 + offsetX, canvasH / 2 + offsetY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.zoom, this.zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  }
}
