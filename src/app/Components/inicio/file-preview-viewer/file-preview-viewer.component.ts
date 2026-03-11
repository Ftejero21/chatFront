import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
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
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import JSZip from 'jszip';

type FileViewerKind =
  | 'none'
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'word'
  | 'zip';

type ZipPreviewEntry = {
  path: string;
  label: string;
  isDir: boolean;
  depth: number;
};

@Component({
  selector: 'app-file-preview-viewer',
  templateUrl: './file-preview-viewer.component.html',
  styleUrl: './file-preview-viewer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewViewerComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() fileUrl = '';
  @Input() fileName = 'Archivo';
  @Input() fileSize = '';
  @Input() fileType = 'Archivo';
  @Input() fileMime = '';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('pdfPagesHost') public pdfPagesHost?: ElementRef<HTMLDivElement>;

  public isExpanded = false;
  public zoom = 100;
  public previewKind: FileViewerKind = 'none';
  public textPreview = '';
  public loadingText = false;
  public textError = '';
  public pdfRendering = false;
  public pdfError = '';
  public pdfPageCount = 1;
  public zipLoading = false;
  public zipError = '';
  public zipSummary = '';
  public zipEntries: ZipPreviewEntry[] = [];
  public wordLoading = false;
  public wordError = '';
  public wordParagraphs: string[] = [];

  private bodyScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyPaddingRight = '';

  private pdfDocument: PDFDocumentProxy | null = null;
  private pdfSourceUrl = '';
  private pdfRenderToken = 0;
  private pdfRerenderTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private static workerConfigured = false;

  public constructor(private readonly cdr: ChangeDetectorRef) {}

  public ngOnChanges(changes: SimpleChanges): void {
    this.debugLog('ngOnChanges', {
      open: this.open,
      fileUrl: this.fileUrl,
      fileMime: this.fileMime,
      fileName: this.fileName,
      changedKeys: Object.keys(changes || {}),
    });
    this.syncBodyScrollLock();

    if (!this.open) {
      this.resetPdfUiState();
      this.clearPdfHost();
      void this.destroyPdfDocument();
      this.markViewForCheck();
      return;
    }

    if (
      changes['open'] ||
      changes['fileUrl'] ||
      changes['fileMime'] ||
      changes['fileName']
    ) {
      void this.preparePreview();
    }
    this.markViewForCheck();
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.unlockBodyScroll();
    void this.destroyPdfDocument();
    if (this.pdfRerenderTimer) {
      clearTimeout(this.pdfRerenderTimer);
      this.pdfRerenderTimer = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscape(event: KeyboardEvent): void {
    if (!this.open) return;
    event.preventDefault();
    this.close();
  }

  @HostListener('window:resize')
  public onWindowResize(): void {
    if (!this.open || this.previewKind !== 'pdf') return;
    this.requestPdfRerender();
  }

  public close(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closed.emit();
  }

  public onBackdropClick(): void {
    this.closed.emit();
  }

  public preventClose(event: MouseEvent): void {
    event.stopPropagation();
  }

  public toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    if (this.previewKind === 'pdf') {
      this.requestPdfRerender();
    }
  }

  public changeZoom(delta: number): void {
    const next = this.zoom + Number(delta || 0);
    this.zoom = Math.min(Math.max(next, 50), 200);
    if (this.previewKind === 'pdf') {
      this.requestPdfRerender();
    }
  }

  public zoomScale(): string {
    if (this.previewKind === 'pdf') return 'none';
    return `scale(${this.zoom / 100})`;
  }

  public getViewerTitle(): string {
    if (this.previewKind === 'pdf') return 'Vista previa de PDF';
    if (this.previewKind === 'image') return 'Vista previa de imagen';
    if (this.previewKind === 'video') return 'Vista previa de video';
    if (this.previewKind === 'audio') return 'Vista previa de audio';
    if (this.previewKind === 'text') return 'Vista previa de texto';
    if (this.previewKind === 'word') return 'Vista previa de Word';
    if (this.previewKind === 'zip') return 'Vista previa de ZIP';
    return 'Vista previa de archivo';
  }

  public getPageIndicator(): string {
    if (this.previewKind === 'pdf') {
      return `Pagina 1 de ${this.pdfPageCount}`;
    }
    if (this.previewKind === 'zip') {
      if (this.zipLoading) return 'Analizando ZIP...';
      return `${this.zipEntries.length} elementos`;
    }
    if (this.previewKind === 'word') {
      if (this.wordLoading) return 'Cargando Word...';
      return `${this.wordParagraphs.length} parrafos`;
    }
    return 'Pagina 1 de 1';
  }

  public trackZipEntry(_index: number, entry: ZipPreviewEntry): string {
    return entry.path;
  }

  public trackWordParagraph(index: number, _paragraph: string): number {
    return index;
  }

  public download(): void {
    const src = String(this.fileUrl || '').trim();
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = this.fileName || 'archivo';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private async preparePreview(): Promise<void> {
    const src = String(this.fileUrl || '').trim();
    const name = String(this.fileName || '').trim();
    this.previewKind = this.resolvePreviewKind(this.fileMime, name);
    this.debugLog('preparePreview:start', {
      src,
      fileName: name,
      fileMime: this.fileMime,
      previewKind: this.previewKind,
    });

    this.textPreview = '';
    this.loadingText = false;
    this.textError = '';
    this.pdfError = '';
    this.resetZipPreview();
    this.resetWordPreview();
    this.markViewForCheck();

    if (!src) {
      this.debugLog('preparePreview:no-src');
      this.previewKind = 'none';
      this.resetPdfUiState();
      this.clearPdfHost();
      await this.destroyPdfDocument();
      this.resetZipPreview();
      this.resetWordPreview();
      this.markViewForCheck();
      return;
    }

    if (this.previewKind === 'pdf') {
      this.debugLog('preparePreview:pdf-route', { src });
      await this.loadAndRenderPdf(src);
      return;
    }

    this.resetPdfUiState();
    this.clearPdfHost();
    await this.destroyPdfDocument();

    if (this.previewKind === 'zip') {
      await this.loadZipPreview(src);
      return;
    }

    if (this.previewKind === 'word') {
      await this.loadWordPreview(src, name, this.fileMime);
      return;
    }

    if (this.previewKind === 'text') {
      this.loadingText = true;
      this.markViewForCheck();
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const text = await response.text();
        const maxChars = 20000;
        this.textPreview =
          text.length > maxChars
            ? `${text.slice(0, maxChars)}\n\n[Previsualizacion recortada]`
            : text;
      } catch {
        this.debugError('preparePreview:text-error', { src });
        this.textError = 'No se pudo cargar la previsualizacion de texto.';
      } finally {
        this.loadingText = false;
        this.markViewForCheck();
      }
    } else {
      this.markViewForCheck();
    }
  }

  private resolvePreviewKind(mimeRaw: unknown, fileNameRaw: unknown): FileViewerKind {
    const mime = String(mimeRaw || '').trim().toLowerCase();
    const fileName = String(fileNameRaw || '').trim().toLowerCase();
    const ext = String(fileName.split('.').pop() || '').trim();

    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (
      ext === 'docx' ||
      ext === 'doc' ||
      mime.includes('wordprocessingml') ||
      mime === 'application/msword'
    ) {
      return 'word';
    }
    if (ext === 'zip' || mime.includes('zip')) return 'zip';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('csv') ||
      ['txt', 'md', 'log', 'json', 'xml', 'csv'].includes(ext)
    ) {
      return 'text';
    }
    return 'none';
  }

  private resetZipPreview(): void {
    this.zipLoading = false;
    this.zipError = '';
    this.zipSummary = '';
    this.zipEntries = [];
  }

  private resetWordPreview(): void {
    this.wordLoading = false;
    this.wordError = '';
    this.wordParagraphs = [];
  }

  private async loadZipPreview(src: string): Promise<void> {
    this.zipLoading = true;
    this.zipError = '';
    this.zipSummary = '';
    this.zipEntries = [];
    this.markViewForCheck();

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const buffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      const entries = Object.values(zip.files)
        .map((entry) => {
          const rawPath = String(entry.name || '').replace(/\\/g, '/');
          const cleanPath = rawPath.replace(/\/+$/, '');
          if (!cleanPath) return null;

          const segments = cleanPath.split('/').filter(Boolean);
          const label = segments[segments.length - 1] || cleanPath;
          return {
            path: rawPath,
            label,
            isDir: entry.dir === true,
            depth: Math.max(0, segments.length - 1),
          } as ZipPreviewEntry;
        })
        .filter((entry): entry is ZipPreviewEntry => !!entry)
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.path.localeCompare(b.path, 'es', { sensitivity: 'base' });
        });

      const maxEntries = 2000;
      const visibleEntries = entries.slice(0, maxEntries);
      const fileCount = entries.filter((x) => !x.isDir).length;
      const folderCount = entries.filter((x) => x.isDir).length;
      const truncated = entries.length > maxEntries;

      this.zipEntries = visibleEntries;
      this.zipSummary = `${folderCount} carpetas, ${fileCount} archivos${
        truncated ? ` (mostrando ${maxEntries})` : ''
      }`;
    } catch (error: unknown) {
      this.debugError('preparePreview:zip-error', { src, error });
      this.zipError = 'No se pudo leer el contenido del ZIP.';
    } finally {
      this.zipLoading = false;
      this.markViewForCheck();
    }
  }

  private async loadWordPreview(
    src: string,
    fileNameRaw: string,
    mimeRaw: string
  ): Promise<void> {
    this.wordLoading = true;
    this.wordError = '';
    this.wordParagraphs = [];
    this.markViewForCheck();

    try {
      const fileName = String(fileNameRaw || '').trim().toLowerCase();
      const ext = String(fileName.split('.').pop() || '').trim();
      const mime = String(mimeRaw || '').trim().toLowerCase();
      const isDocx =
        ext === 'docx' ||
        mime.includes('wordprocessingml') ||
        mime ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isLegacyDoc = ext === 'doc' || mime === 'application/msword';

      if (!isDocx && isLegacyDoc) {
        this.wordError =
          'La previsualizacion de .doc no esta soportada en navegador. Descarga el archivo para verlo.';
        return;
      }

      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const buffer = await response.arrayBuffer();

      const zip = await JSZip.loadAsync(buffer);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) {
        this.wordError = 'No se encontro el contenido interno del documento Word.';
        return;
      }

      const xml = await docXmlFile.async('text');
      const paragraphs = this.extractDocxParagraphs(xml);
      if (!paragraphs.length) {
        this.wordError = 'No se pudo extraer texto visible del documento Word.';
        return;
      }

      const maxParagraphs = 1200;
      this.wordParagraphs = paragraphs.slice(0, maxParagraphs);
    } catch (error: unknown) {
      this.debugError('preparePreview:word-error', { src, error });
      this.wordError = 'No se pudo previsualizar el archivo Word.';
    } finally {
      this.wordLoading = false;
      this.markViewForCheck();
    }
  }

  private extractDocxParagraphs(xmlRaw: string): string[] {
    const parser = new DOMParser();
    const xml = parser.parseFromString(String(xmlRaw || ''), 'application/xml');
    if (xml.querySelector('parsererror')) return [];

    const paragraphs: string[] = [];
    const paragraphNodes = Array.from(xml.getElementsByTagNameNS('*', 'p'));

    for (const paragraphNode of paragraphNodes) {
      const runNodes = Array.from(paragraphNode.getElementsByTagNameNS('*', 'r'));
      let line = '';

      for (const run of runNodes) {
        for (const childNode of Array.from(run.childNodes)) {
          if (!(childNode instanceof Element)) continue;
          const local = String(childNode.localName || '').toLowerCase();
          if (local === 't') {
            line += childNode.textContent || '';
            continue;
          }
          if (local === 'tab') {
            line += '\t';
            continue;
          }
          if (local === 'br' || local === 'cr') {
            line += '\n';
          }
        }
      }

      const normalized = line.replace(/\u00a0/g, ' ').trim();
      if (normalized) paragraphs.push(normalized);
    }

    if (paragraphs.length) return paragraphs;

    const fallback = Array.from(xml.getElementsByTagNameNS('*', 't'))
      .map((node) => String(node.textContent || '').trim())
      .filter((text) => !!text);
    if (!fallback.length) return [];
    return [fallback.join(' ')];
  }

  private async loadAndRenderPdf(src: string): Promise<void> {
    const token = ++this.pdfRenderToken;
    this.pdfRendering = true;
    this.pdfError = '';
    this.markViewForCheck();
    this.debugLog('loadAndRenderPdf:start', { src, token });

    try {
      if (!this.pdfDocument || this.pdfSourceUrl !== src) {
        await this.destroyPdfDocument(false);
        this.configurePdfWorker();

        const isBlobOrDataSource = /^(blob:|data:)/i.test(src);
        this.debugLog('loadAndRenderPdf:getDocument', {
          src,
          token,
          isBlobOrDataSource,
          withCredentials: !isBlobOrDataSource,
          disableWorker: false,
        });
        const loadingTask = getDocument({
          url: src,
          withCredentials: !isBlobOrDataSource,
          disableWorker: false,
        } as any);

        const loaded = await this.withTimeout(loadingTask.promise, 15000);
        if (token !== this.pdfRenderToken) {
          this.debugLog('loadAndRenderPdf:stale-token-destroy', { token });
          await loaded.destroy();
          return;
        }

        this.pdfDocument = loaded;
        this.pdfSourceUrl = src;
        this.pdfPageCount = loaded.numPages;
        this.debugLog('loadAndRenderPdf:loaded', {
          src,
          token,
          numPages: loaded.numPages,
        });
        this.markViewForCheck();
      }

      await this.renderPdfPages(token);
      this.debugLog('loadAndRenderPdf:render-complete', {
        src,
        token,
        pageCount: this.pdfPageCount,
      });
    } catch (error: unknown) {
      if (token !== this.pdfRenderToken) return;
      this.debugError('loadAndRenderPdf:error', {
        src,
        token,
        error,
      });
      this.pdfError = 'No se pudo renderizar el PDF.';
      this.clearPdfHost();
      this.markViewForCheck();
    } finally {
      if (token === this.pdfRenderToken) {
        this.pdfRendering = false;
        this.markViewForCheck();
      }
    }
  }

  private configurePdfWorker(): void {
    if (FilePreviewViewerComponent.workerConfigured) return;
    GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
    FilePreviewViewerComponent.workerConfigured = true;
    this.debugLog('configurePdfWorker', {
      workerSrc: GlobalWorkerOptions.workerSrc,
    });
  }

  private requestPdfRerender(): void {
    if (!this.open || this.previewKind !== 'pdf' || !this.pdfDocument) return;

    if (this.pdfRerenderTimer) {
      clearTimeout(this.pdfRerenderTimer);
    }

    this.pdfRerenderTimer = setTimeout(() => {
      this.pdfRerenderTimer = null;
      if (!this.open || this.previewKind !== 'pdf' || !this.pdfDocument) return;
      const token = ++this.pdfRenderToken;
      this.pdfRendering = true;
      this.markViewForCheck();
      void this.renderPdfPages(token).finally(() => {
        if (token === this.pdfRenderToken) {
          this.pdfRendering = false;
          this.markViewForCheck();
        }
      });
    }, 90);
  }

  private async renderPdfPages(token: number): Promise<void> {
    const doc = this.pdfDocument;
    if (!doc) return;

    const host = await this.waitForPdfHost();
    if (!host || token !== this.pdfRenderToken) {
      if (token === this.pdfRenderToken) {
        this.debugError('renderPdfPages:no-host', {
          token,
          hasHost: !!host,
          currentToken: this.pdfRenderToken,
        });
        this.pdfError = 'No se pudo inicializar el visor de PDF.';
        this.markViewForCheck();
      }
      return;
    }

    host.innerHTML = '';

    const hostWidth = Math.max(host.clientWidth, 320);
    const zoomFactor = this.zoom / 100;
    this.debugLog('renderPdfPages:start', {
      token,
      numPages: doc.numPages,
      hostWidth,
      zoom: this.zoom,
    });

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      if (token !== this.pdfRenderToken) return;

      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = (hostWidth - 24) / baseViewport.width;
      const scale = Math.max(0.25, fitScale * zoomFactor);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      const shell = document.createElement('div');
      shell.className = 'pdf-page-shell';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        continue;
      }

      shell.appendChild(canvas);
      host.appendChild(shell);
      this.debugLog('renderPdfPages:page-start', {
        token,
        pageNumber,
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        dpr,
      });

      await this.withTimeout(
        page.render({
          canvasContext: context,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        }).promise,
        12000
      );
      this.debugLog('renderPdfPages:page-done', { token, pageNumber });
    }
  }

  private async waitForPdfHost(maxFrames = 40): Promise<HTMLDivElement | null> {
    for (let i = 0; i < maxFrames; i++) {
      const host = this.pdfPagesHost?.nativeElement;
      if (host) {
        return host;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return null;
  }

  private clearPdfHost(): void {
    const host = this.pdfPagesHost?.nativeElement;
    if (host) {
      host.innerHTML = '';
    }
  }

  private resetPdfUiState(): void {
    this.pdfRendering = false;
    this.pdfError = '';
    this.pdfPageCount = 1;
  }

  private async destroyPdfDocument(invalidateRenderToken = true): Promise<void> {
    if (invalidateRenderToken) {
      this.pdfRenderToken++;
    }

    if (this.pdfRerenderTimer) {
      clearTimeout(this.pdfRerenderTimer);
      this.pdfRerenderTimer = null;
    }

    const current = this.pdfDocument;
    this.pdfDocument = null;
    this.pdfSourceUrl = '';

    if (!current) return;

    try {
      await current.destroy();
    } catch {
      // Ignore PDF destroy errors to avoid breaking UI cleanup.
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('PDF_TIMEOUT')), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private syncBodyScrollLock(): void {
    if (this.open) {
      this.lockBodyScroll();
      return;
    }
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    if (this.bodyScrollLocked || typeof document === 'undefined') return;
    const body = document.body;
    const docEl = document.documentElement;
    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyPaddingRight = body.style.paddingRight;
    const scrollBarWidth = Math.max(0, window.innerWidth - docEl.clientWidth);
    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }
    this.bodyScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked || typeof document === 'undefined') return;
    const body = document.body;
    body.style.overflow = this.previousBodyOverflow;
    body.style.paddingRight = this.previousBodyPaddingRight;
    this.bodyScrollLocked = false;
  }

  private markViewForCheck(): void {
    if (this.destroyed) return;
    this.cdr.markForCheck();
  }

  private debugLog(label: string, data?: unknown): void {
  }

  private debugError(label: string, data?: unknown): void {
    console.error(`[FilePreviewViewer] ${label}`, data ?? '');
  }
}

