import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SecurityContext,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  DomSanitizer,
} from '@angular/platform-browser';
import JSZip from 'jszip';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type PreviewCategory =
  | 'image'
  | 'pdf'
  | 'audio'
  | 'text'
  | 'office'
  | 'archive'
  | 'unsupported';

type PreviewDetection = {
  category: PreviewCategory;
  isHtmlText: boolean;
  isVideo: boolean;
};

type ResolvedFileSource = {
  url: string;
  blob: Blob | null;
  displayName: string;
  mimeType: string;
  extension: string;
};

type TextLoadResult = {
  text: string;
  truncated: boolean;
  bytes: Uint8Array;
};

type ArchivePreviewEntry = {
  path: string;
  label: string;
  isDir: boolean;
  depth: number;
};

interface FilePreviewModel {
  category: PreviewCategory;
  sourceUrl: string;
  displayName: string;
  mimeType: string;
  extension: string;
  isHtmlText: boolean;
  message: string;
}

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
]);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const TEXT_EXTENSIONS = new Set(['txt', 'json', 'xml', 'csv', 'log', 'md']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);
const OFFICE_EXTENSIONS = new Set([
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);
const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mkv',
  'webm',
  'mov',
  'avi',
  'wmv',
  'm4v',
  '3gp',
]);

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
  @Input() file: File | Blob | null | undefined = null;

  @Output() closed = new EventEmitter<void>();
  @ViewChild('pdfPagesHost') public pdfPagesHost?: ElementRef<HTMLDivElement>;

  public isExpanded = false;
  public zoom = 100;
  public previewKind: PreviewCategory = 'unsupported';
  public preview: FilePreviewModel = this.createDefaultPreview();

  public resolvedFileName = 'Archivo';
  public previewUrl = '';
  public pdfRendering = false;
  public pdfError = '';
  public pdfPageCount = 1;

  public renderError = '';
  public textPreview = '';
  public loadingText = false;
  public textError = '';
  public textTruncated = false;
  public officeLoading = false;
  public officeError = '';
  public officeParagraphs: string[] = [];
  public archiveLoading = false;
  public archiveError = '';
  public archiveSummary = '';
  public archiveEntries: ArchivePreviewEntry[] = [];

  private bodyScrollLocked = false;
  private previousBodyOverflow = '';
  private previousBodyPaddingRight = '';

  private createdObjectUrl: string | null = null;
  private destroyed = false;
  private pdfDocument: PDFDocumentProxy | null = null;
  private pdfSourceUrl = '';
  private pdfRenderToken = 0;
  private pdfRerenderTimer: ReturnType<typeof setTimeout> | null = null;
  private static workerConfigured = false;

  private readonly textPreviewMaxBytes = 512 * 1024;

  public constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly sanitizer: DomSanitizer
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    this.syncBodyScrollLock();

    if (!this.open) {
      this.resetTransientPreviewState();
      this.releaseCreatedObjectUrl();
      this.clearPdfHost();
      void this.destroyPdfDocument();
      this.markViewForCheck();
      return;
    }

    if (
      changes['open'] ||
      changes['fileUrl'] ||
      changes['fileMime'] ||
      changes['fileName'] ||
      changes['file']
    ) {
      void this.preparePreview();
    }
    this.markViewForCheck();
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.unlockBodyScroll();
    this.releaseCreatedObjectUrl();
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
  }

  public changeZoom(delta: number): void {
    const next = this.zoom + Number(delta || 0);
    this.zoom = Math.min(Math.max(next, 50), 200);
    if (this.previewKind === 'pdf') {
      this.requestPdfRerender();
    }
  }

  public zoomScale(): string {
    if (
      this.previewKind === 'pdf' ||
      this.previewKind === 'audio' ||
      this.previewKind === 'office' ||
      this.previewKind === 'archive' ||
      this.previewKind === 'unsupported'
    ) {
      return 'none';
    }
    return `scale(${this.zoom / 100})`;
  }

  public getViewerTitle(): string {
    if (this.previewKind === 'pdf') return 'Vista previa de PDF';
    if (this.previewKind === 'image') return 'Vista previa de imagen';
    if (this.previewKind === 'audio') return 'Vista previa de audio';
    if (this.previewKind === 'office') return 'Vista previa de Office';
    if (this.previewKind === 'archive') return 'Vista previa de archivo comprimido';
    if (this.previewKind === 'text') return 'Vista previa de texto';
    return 'Vista previa no disponible';
  }

  public getPageIndicator(): string {
    if (this.previewKind === 'text' && this.loadingText) return 'Cargando texto...';
    if (this.previewKind === 'office' && this.officeLoading) return 'Cargando Word...';
    if (this.previewKind === 'archive') {
      if (this.archiveLoading) return 'Leyendo ZIP...';
      if (this.archiveEntries.length) return `${this.archiveEntries.length} elementos`;
    }
    return 'Pagina 1 de 1';
  }

  public onMediaRenderError(kind: 'image' | 'pdf' | 'audio'): void {
    if (!this.open) return;

    if (kind === 'image') {
      this.setUnsupportedPreview('El navegador no pudo renderizar esta imagen.');
      return;
    }

    if (kind === 'pdf') {
      this.setUnsupportedPreview(
        'Este navegador no pudo mostrar el PDF embebido. Puedes descargarlo.'
      );
      return;
    }

    this.setUnsupportedPreview(
      'Este navegador no pudo reproducir el archivo de audio.'
    );
  }

  public formatBytes(bytesRaw: number): string {
    const bytes = Number(bytesRaw || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  }

  public trackArchiveEntry(_index: number, entry: ArchivePreviewEntry): string {
    return entry.path;
  }

  public trackOfficeParagraph(index: number, _paragraph: string): number {
    return index;
  }

  public download(): void {
    const src = String(this.preview.sourceUrl || this.previewUrl || '').trim();
    if (!src) return;

    const link = document.createElement('a');
    link.href = src;
    link.download = this.resolvedFileName || 'archivo';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private async preparePreview(): Promise<void> {
    this.resetTransientPreviewState();
    this.releaseCreatedObjectUrl();

    const source = this.resolveFileSource();
    this.resolvedFileName = source.displayName || 'Archivo';

    if (!source.url) {
      this.setUnsupportedPreview('No hay archivo disponible para previsualizar.');
      return;
    }

    const sanitized = this.sanitizeUrl(source.url);
    if (!sanitized) {
      this.setUnsupportedPreview('La URL del archivo no es segura para previsualizar.');
      return;
    }

    const detection = this.detectPreviewCategory(
      source.extension,
      source.mimeType,
      this.fileType
    );
    this.preview = {
      category: detection.category,
      sourceUrl: sanitized,
      displayName: this.resolvedFileName,
      mimeType: source.mimeType,
      extension: source.extension,
      isHtmlText: detection.isHtmlText,
      message: this.resolveBaseMessage(detection, source.extension),
    };
    this.previewKind = detection.category;
    this.previewUrl = sanitized;

    if (this.previewKind === 'pdf') {
      await this.loadAndRenderPdf(sanitized);
      return;
    }

    this.clearPdfHost();
    await this.destroyPdfDocument();

    if (this.previewKind === 'office') {
      await this.loadOfficePreview(source);
      return;
    }

    if (this.previewKind === 'audio') {
      const canPlay = this.canPlayAudio(source.mimeType, source.extension);
      if (!canPlay) {
        this.setUnsupportedPreview(
          'El navegador no soporta reproducir este audio. Puedes descargar el archivo.'
        );
        return;
      }
      this.markViewForCheck();
      return;
    }

    if (this.previewKind === 'text') {
      await this.loadTextPreview(source);
      return;
    }

    if (this.previewKind === 'archive') {
      await this.loadArchivePreview(source);
      return;
    }

    this.markViewForCheck();
  }

  private resolveFileSource(): ResolvedFileSource {
    const inputBlob = this.file ?? null;
    const preferredNameInput = String(this.fileName || '').trim();
    const preferredMimeInput = String(this.fileMime || '').trim().toLowerCase();

    if (inputBlob) {
      const objectUrl = URL.createObjectURL(inputBlob);
      this.createdObjectUrl = objectUrl;

      const fileName =
        preferredNameInput && preferredNameInput.toLowerCase() !== 'archivo'
          ? preferredNameInput
          : inputBlob instanceof File && String(inputBlob.name || '').trim()
          ? String(inputBlob.name || '').trim()
          : 'Archivo';

      const mime =
        preferredMimeInput || String(inputBlob.type || '').trim().toLowerCase();

      return {
        url: objectUrl,
        blob: inputBlob,
        displayName: fileName,
        mimeType: mime,
        extension: this.extractExtension(fileName),
      };
    }

    const directUrl = String(this.fileUrl || '').trim();
    const displayName = this.resolveNameForUrl(directUrl, preferredNameInput);

    return {
      url: directUrl,
      blob: null,
      displayName,
      mimeType: preferredMimeInput,
      extension: this.extractExtension(displayName || directUrl),
    };
  }

  private resolveNameForUrl(url: string, preferredNameInput: string): string {
    if (preferredNameInput && preferredNameInput.toLowerCase() !== 'archivo') {
      return preferredNameInput;
    }

    if (!url) return 'Archivo';

    try {
      const parsed = new URL(url, window.location.href);
      const lastSegment = decodeURIComponent(
        String(parsed.pathname || '').split('/').filter(Boolean).pop() || ''
      ).trim();
      if (lastSegment) return lastSegment;
      return 'Archivo';
    } catch {
      const clean = decodeURIComponent(url.split(/[?#]/)[0] || '');
      const lastSegment = clean.split('/').filter(Boolean).pop() || '';
      return lastSegment.trim() || 'Archivo';
    }
  }

  private sanitizeUrl(url: string): string {
    const safe = this.sanitizer.sanitize(SecurityContext.URL, String(url || '').trim());
    return String(safe || '').trim();
  }

  private detectPreviewCategory(
    extensionRaw: string,
    mimeRaw: string,
    fileTypeRaw: string
  ): PreviewDetection {
    const ext = String(extensionRaw || '').toLowerCase();
    const mime = String(mimeRaw || '').toLowerCase();
    const typeLabel = String(fileTypeRaw || '')
      .trim()
      .toLowerCase();

    const isImage = IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/');
    if (isImage) return { category: 'image', isHtmlText: false, isVideo: false };

    const isPdf = ext === 'pdf' || mime === 'application/pdf';
    if (isPdf) return { category: 'pdf', isHtmlText: false, isVideo: false };

    const isAudio =
      AUDIO_EXTENSIONS.has(ext) ||
      mime.startsWith('audio/') ||
      mime === 'application/ogg' ||
      mime === 'audio/mp4' ||
      mime === 'audio/x-m4a';
    if (isAudio) return { category: 'audio', isHtmlText: false, isVideo: false };

    const isHtmlText =
      HTML_EXTENSIONS.has(ext) ||
      mime === 'text/html' ||
      mime === 'application/xhtml+xml';
    if (isHtmlText) return { category: 'text', isHtmlText: true, isVideo: false };

    const isText =
      TEXT_EXTENSIONS.has(ext) ||
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('csv');
    if (isText) return { category: 'text', isHtmlText: false, isVideo: false };

    const isOffice =
      OFFICE_EXTENSIONS.has(ext) ||
      mime.includes('wordprocessingml') ||
      mime.includes('spreadsheetml') ||
      mime.includes('presentationml') ||
      mime === 'application/msword' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.ms-powerpoint';
    if (isOffice) return { category: 'office', isHtmlText: false, isVideo: false };

    const isArchive =
      ARCHIVE_EXTENSIONS.has(ext) ||
      mime.includes('zip') ||
      mime.includes('rar') ||
      mime.includes('7z') ||
      mime.includes('tar') ||
      mime.includes('gzip') ||
      mime.includes('x-gtar');
    if (isArchive) return { category: 'archive', isHtmlText: false, isVideo: false };

    const isVideo = VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/');
    if (isVideo) return { category: 'unsupported', isHtmlText: false, isVideo: true };

    const labelAsPdf = typeLabel.includes('pdf');
    if (labelAsPdf) return { category: 'pdf', isHtmlText: false, isVideo: false };

    const labelAsImage = typeLabel.includes('imagen') || typeLabel.includes('image');
    if (labelAsImage) return { category: 'image', isHtmlText: false, isVideo: false };

    const labelAsAudio = typeLabel.includes('audio');
    if (labelAsAudio) return { category: 'audio', isHtmlText: false, isVideo: false };

    const labelAsText =
      typeLabel.includes('texto') ||
      typeLabel.includes('text') ||
      typeLabel.includes('json') ||
      typeLabel.includes('xml') ||
      typeLabel.includes('csv') ||
      typeLabel.includes('log');
    if (labelAsText) return { category: 'text', isHtmlText: false, isVideo: false };

    const labelAsOffice =
      typeLabel.includes('word') ||
      typeLabel.includes('hoja de calculo') ||
      typeLabel.includes('hoja de cálculo') ||
      typeLabel.includes('presentacion') ||
      typeLabel.includes('presentación') ||
      typeLabel.includes('office');
    if (labelAsOffice) return { category: 'office', isHtmlText: false, isVideo: false };

    const labelAsArchive =
      typeLabel.includes('comprimido') || typeLabel.includes('zip');
    if (labelAsArchive) return { category: 'archive', isHtmlText: false, isVideo: false };

    const labelAsVideo = typeLabel.includes('video');
    return { category: 'unsupported', isHtmlText: false, isVideo: labelAsVideo };
  }

  private resolveBaseMessage(
    detection: PreviewDetection,
    extensionRaw: string
  ): string {
    const extension = String(extensionRaw || '').toLowerCase();

    if (detection.category === 'office') {
      return 'La vista previa de archivos Office no esta disponible en navegador sin backend o librerias especificas.';
    }

    if (detection.category === 'archive') {
      return 'La vista previa de archivos comprimidos no esta disponible en navegador.';
    }

    if (detection.isVideo) {
      return 'La previsualizacion de video no esta habilitada actualmente. Descarga el archivo para verlo.';
    }

    if (detection.category === 'unsupported') {
      const suffix = extension ? ` (.${extension})` : '';
      return `No hay previsualizacion disponible para este tipo de archivo${suffix}.`;
    }

    return '';
  }

  private async loadArchivePreview(source: ResolvedFileSource): Promise<void> {
    this.archiveLoading = true;
    this.archiveError = '';
    this.archiveSummary = '';
    this.archiveEntries = [];
    this.markViewForCheck();

    const ext = String(source.extension || '').toLowerCase();
    const mime = String(source.mimeType || '').toLowerCase();
    let buffer: ArrayBuffer | null = null;
    try {
      buffer = source.blob
        ? await source.blob.arrayBuffer()
        : await this.readArrayBufferFromRemote(source.url);

      if (ext === '7z' || mime.includes('7z')) {
        const recovered7z = this.buildArchiveEntriesFromRawPaths(
          this.extract7zEntriesByHeuristic(buffer)
        );
        if (recovered7z.length) {
          const maxEntries = 1500;
          this.archiveEntries = recovered7z.slice(0, maxEntries);
          const fileCount = recovered7z.filter((x) => !x.isDir).length;
          const dirCount = recovered7z.filter((x) => x.isDir).length;
          this.archiveSummary = `${dirCount} carpetas, ${fileCount} archivos${
            recovered7z.length > maxEntries ? ` (mostrando ${maxEntries})` : ''
          }`;
          this.preview = {
            ...this.preview,
            message: 'Contenido de 7z (modo compatibilidad).',
          };
          return;
        }
        this.archiveError =
          'No se pudo extraer listado interno del 7z en navegador.';
        this.preview = {
          ...this.preview,
          message:
            'No se pudo previsualizar este 7z completamente. Usa Descargar.',
        };
        return;
      }

      const zip = await JSZip.loadAsync(buffer);
      const rawPaths = Object.values(zip.files).map((entry) =>
        String(entry.name || '')
      );
      if (this.isOfficeZipPackage(rawPaths)) {
        this.previewKind = 'office';
        this.preview = {
          ...this.preview,
          category: 'office',
          message: 'Archivo Office detectado.',
        };
        await this.loadOfficePreview(source);
        return;
      }

      const allEntries = this.buildArchiveEntriesFromRawPaths(rawPaths);

      const maxEntries = 1500;
      this.archiveEntries = allEntries.slice(0, maxEntries);
      const fileCount = allEntries.filter((x) => !x.isDir).length;
      const dirCount = allEntries.filter((x) => x.isDir).length;
      this.archiveSummary = `${dirCount} carpetas, ${fileCount} archivos${
        allEntries.length > maxEntries ? ` (mostrando ${maxEntries})` : ''
      }`;
      this.preview = {
        ...this.preview,
        message: allEntries.length
          ? 'Contenido del ZIP.'
          : 'ZIP sin contenido visible.',
      };
    } catch (error: unknown) {
      this.debugError('archive-preview-error', error);
      const isLikelyZip = ext === 'zip' || mime.includes('zip');

      if (isLikelyZip && buffer) {
        const fromCentral = this.extractZipEntriesFromCentralDirectory(buffer);
        const fromHeaders = this.extractZipEntriesFromLocalHeaders(buffer);
        const fromText = this.extractZipEntriesByHeuristic(buffer);
        const rawPathsFromHeaders = Array.from(
          new Set([...fromCentral, ...fromHeaders, ...fromText])
        );
        if (this.isOfficeZipPackage(rawPathsFromHeaders)) {
          this.previewKind = 'office';
          this.preview = {
            ...this.preview,
            category: 'office',
            message: 'Archivo Office detectado.',
          };
          await this.loadOfficePreview(source);
          return;
        }

        const recovered = this.buildArchiveEntriesFromRawPaths(rawPathsFromHeaders);
        if (recovered.length) {
          const maxEntries = 1500;
          this.archiveEntries = recovered.slice(0, maxEntries);
          const fileCount = recovered.filter((x) => !x.isDir).length;
          const dirCount = recovered.filter((x) => x.isDir).length;
          this.archiveSummary = `${dirCount} carpetas, ${fileCount} archivos${
            recovered.length > maxEntries ? ` (mostrando ${maxEntries})` : ''
          }`;
          this.preview = {
            ...this.preview,
            message: 'Contenido del ZIP (modo compatibilidad).',
          };
          return;
        }
      }

      this.archiveError = isLikelyZip ? 'No se pudo leer el ZIP en el navegador.' : '';
      this.preview = {
        ...this.preview,
        message: isLikelyZip
          ? 'No se pudo previsualizar este ZIP. Usa Descargar.'
          : 'Solo se puede listar contenido de ZIP en navegador. Para este formato comprimido, usa Descargar.',
      };
    } finally {
      this.archiveLoading = false;
      this.markViewForCheck();
    }
  }

  private isOfficeZipPackage(rawPaths: string[]): boolean {
    if (!rawPaths.length) return false;
    const lower = rawPaths.map((path) => String(path || '').toLowerCase());
    return (
      lower.includes('word/document.xml') ||
      lower.some((p) => p.startsWith('word/')) ||
      lower.some((p) => p.startsWith('xl/')) ||
      lower.some((p) => p.startsWith('ppt/'))
    );
  }

  private buildArchiveEntriesFromRawPaths(rawPaths: string[]): ArchivePreviewEntry[] {
    const known = new Map<string, ArchivePreviewEntry>();

    const pushDir = (pathNoTrailingSlash: string): void => {
      const normalized = String(pathNoTrailingSlash || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .trim();
      if (!normalized) return;
      const segments = normalized.split('/').filter(Boolean);
      if (!segments.length) return;
      const key = `${normalized}/`;
      if (known.has(key)) return;
      known.set(key, {
        path: key,
        label: segments[segments.length - 1] || normalized,
        isDir: true,
        depth: Math.max(0, segments.length - 1),
      });
    };

    const pushFile = (pathNoTrailingSlash: string): void => {
      const normalized = String(pathNoTrailingSlash || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .trim();
      if (!normalized) return;
      const segments = normalized.split('/').filter(Boolean);
      if (!segments.length) return;
      const key = normalized;
      if (known.has(key)) return;
      known.set(key, {
        path: key,
        label: segments[segments.length - 1] || normalized,
        isDir: false,
        depth: Math.max(0, segments.length - 1),
      });
    };

    for (const rawPath of rawPaths) {
      const raw = String(rawPath || '').replace(/\\/g, '/').trim();
      if (!raw) continue;

      const clean = raw.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!clean) continue;

      const segments = clean.split('/').filter(Boolean);
      if (!segments.length) continue;

      let currentDir = '';
      for (let i = 0; i < segments.length - 1; i++) {
        currentDir = currentDir ? `${currentDir}/${segments[i]}` : segments[i];
        pushDir(currentDir);
      }

      if (raw.endsWith('/')) {
        pushDir(clean);
      } else {
        pushFile(clean);
      }
    }

    return Array.from(known.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.path.localeCompare(b.path, 'es', { sensitivity: 'base' });
    });
  }

  private extractZipEntriesFromLocalHeaders(buffer: ArrayBuffer): string[] {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const names: string[] = [];
    const max = Math.max(0, bytes.length - 30);

    for (let i = 0; i <= max; i++) {
      if (
        bytes[i] !== 0x50 ||
        bytes[i + 1] !== 0x4b ||
        bytes[i + 2] !== 0x03 ||
        bytes[i + 3] !== 0x04
      ) {
        continue;
      }

      const gpFlag = view.getUint16(i + 6, true);
      const nameLen = view.getUint16(i + 26, true);
      const extraLen = view.getUint16(i + 28, true);
      if (!nameLen) continue;

      const nameStart = i + 30;
      const nameEnd = nameStart + nameLen;
      if (nameEnd > bytes.length) continue;

      const nameBytes = bytes.subarray(nameStart, nameEnd);
      const useUtf8 = (gpFlag & 0x0800) !== 0;
      let decoded = '';
      try {
        decoded = new TextDecoder(useUtf8 ? 'utf-8' : 'latin1', {
          fatal: false,
        }).decode(nameBytes);
      } catch {
        decoded = '';
      }

      const clean = decoded.replace(/\u0000/g, '').trim();
      if (clean) names.push(clean);

      const jump = nameEnd + extraLen;
      if (jump > i) {
        i = jump - 1;
      }
    }

    return names;
  }

  private extractZipEntriesFromCentralDirectory(buffer: ArrayBuffer): string[] {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const names: string[] = [];
    const sig = [0x50, 0x4b, 0x01, 0x02]; // central directory file header
    const max = Math.max(0, bytes.length - 46);

    for (let i = 0; i <= max; i++) {
      if (
        bytes[i] !== sig[0] ||
        bytes[i + 1] !== sig[1] ||
        bytes[i + 2] !== sig[2] ||
        bytes[i + 3] !== sig[3]
      ) {
        continue;
      }

      const gpFlag = view.getUint16(i + 8, true);
      const nameLen = view.getUint16(i + 28, true);
      const extraLen = view.getUint16(i + 30, true);
      const commentLen = view.getUint16(i + 32, true);
      if (!nameLen) continue;

      const nameStart = i + 46;
      const nameEnd = nameStart + nameLen;
      if (nameEnd > bytes.length) continue;

      const nameBytes = bytes.subarray(nameStart, nameEnd);
      const useUtf8 = (gpFlag & 0x0800) !== 0;
      let decoded = '';
      try {
        decoded = new TextDecoder(useUtf8 ? 'utf-8' : 'latin1', {
          fatal: false,
        }).decode(nameBytes);
      } catch {
        decoded = '';
      }

      const clean = decoded.replace(/\u0000/g, '').trim();
      if (clean) names.push(clean);

      const next = nameEnd + extraLen + commentLen;
      if (next > i) {
        i = next - 1;
      }
    }

    return names;
  }

  private extractZipEntriesByHeuristic(buffer: ArrayBuffer): string[] {
    const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    const regex = /([A-Za-z0-9 _.\-]+\/[A-Za-z0-9 _.\-\/]{1,240})/g;
    const out = new Set<string>();
    let match: RegExpExecArray | null = null;

    while ((match = regex.exec(text)) !== null) {
      const raw = String(match[1] || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .trim();
      if (!raw) continue;
      if (raw.length > 240) continue;
      if (/[^\x20-\x7E]/.test(raw)) continue;
      if (raw.split('/').some((part) => part.length > 120)) continue;
      out.add(raw);
      if (out.size >= 3000) break;
    }

    return Array.from(out);
  }

  private extract7zEntriesByHeuristic(buffer: ArrayBuffer): string[] {
    const bytes = new Uint8Array(buffer);
    const found = new Set<string>();

    const pushCandidate = (raw: string): void => {
      const normalized = this.normalizeArchivePathCandidate(raw);
      if (!normalized) return;
      found.add(normalized);
      if (found.size > 4000) return;
    };

    // 1) ASCII scan: useful when names are stored plain.
    let start = -1;
    for (let i = 0; i <= bytes.length; i++) {
      const b = i < bytes.length ? bytes[i] : 0;
      const printable = b >= 32 && b <= 126;
      if (printable) {
        if (start < 0) start = i;
        continue;
      }
      if (start >= 0) {
        const len = i - start;
        if (len >= 4 && len <= 280) {
          const text = new TextDecoder('latin1').decode(bytes.subarray(start, i));
          if (text.includes('/') || text.includes('\\')) {
            pushCandidate(text);
          }
        }
        start = -1;
      }
    }

    // 2) UTF-16LE scan: common for 7z file names.
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i + 1] !== 0) continue;
      const chars: number[] = [];
      let j = i;
      while (j + 1 < bytes.length && bytes[j + 1] === 0) {
        const code = bytes[j];
        if (code === 0) break;
        if (code < 32 || code > 126) break;
        chars.push(code);
        j += 2;
        if (chars.length > 280) break;
      }
      if (chars.length >= 4) {
        const text = String.fromCharCode(...chars);
        if (text.includes('/') || text.includes('\\')) {
          pushCandidate(text);
        }
      }
      if (chars.length > 12) {
        i = j - 1;
      }
    }

    return Array.from(found);
  }

  private normalizeArchivePathCandidate(raw: string): string {
    let path = String(raw || '')
      .replace(/\u0000/g, '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .trim();
    if (!path) return '';
    if (path.startsWith('./')) path = path.slice(2);
    if (!path) return '';
    if (path.includes('..')) return '';
    if (path.length > 260) return '';
    if (/[^\x20-\x7E\/]/.test(path)) return '';
    if (!path.includes('/')) {
      // Keep single files only when they look like file names.
      if (!/\.[a-z0-9]{1,8}$/i.test(path)) return '';
    }
    return path;
  }

  private async readArrayBufferFromRemote(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      credentials: this.shouldIncludeCredentials(url) ? 'include' : 'omit',
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.arrayBuffer();
  }

  private async loadAndRenderPdf(src: string): Promise<void> {
    const token = ++this.pdfRenderToken;
    this.pdfRendering = true;
    this.pdfError = '';
    this.markViewForCheck();

    try {
      if (!this.pdfDocument || this.pdfSourceUrl !== src) {
        await this.destroyPdfDocument(false);
        this.configurePdfWorker();

        const isBlobOrDataSource = /^(blob:|data:)/i.test(src);
        const loadingTask = getDocument({
          url: src,
          withCredentials: !isBlobOrDataSource,
          disableWorker: false,
        } as any);

        const loaded = await this.withTimeout(loadingTask.promise, 15000);
        if (token !== this.pdfRenderToken) {
          await loaded.destroy();
          return;
        }

        this.pdfDocument = loaded;
        this.pdfSourceUrl = src;
        this.pdfPageCount = loaded.numPages;
        this.markViewForCheck();
      }

      await this.renderPdfPages(token);
    } catch (error: unknown) {
      if (token !== this.pdfRenderToken) return;
      this.debugError('loadAndRenderPdf:error', { src, token, error });
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
        this.pdfError = 'No se pudo inicializar el visor de PDF.';
        this.markViewForCheck();
      }
      return;
    }

    host.innerHTML = '';
    const hostWidth = Math.max(host.clientWidth, 340);
    const zoomFactor = this.zoom / 100;

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      if (token !== this.pdfRenderToken) return;

      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = (hostWidth - 32) / baseViewport.width;
      const scale = Math.max(0.35, fitScale * zoomFactor * 0.78);
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
      if (!context) continue;

      shell.appendChild(canvas);
      host.appendChild(shell);

      await this.withTimeout(
        page.render({
          canvasContext: context,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        }).promise,
        12000
      );
    }
  }

  private async waitForPdfHost(maxFrames = 40): Promise<HTMLDivElement | null> {
    for (let i = 0; i < maxFrames; i++) {
      const host = this.pdfPagesHost?.nativeElement;
      if (host) return host;
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
    this.pdfPageCount = 1;

    if (!current) return;

    try {
      await current.destroy();
    } catch {
      // Ignore cleanup errors.
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

  private canPlayAudio(mimeRaw: string, extensionRaw: string): boolean {
    if (typeof document === 'undefined') return false;
    const audio = document.createElement('audio');
    if (typeof audio.canPlayType !== 'function') return false;

    const mime = String(mimeRaw || '').toLowerCase();
    const extension = String(extensionRaw || '').toLowerCase();
    const probes: string[] = [];

    if (mime) probes.push(mime);
    if (extension === 'mp3') probes.push('audio/mpeg');
    if (extension === 'wav') probes.push('audio/wav');
    if (extension === 'ogg') probes.push('audio/ogg');
    if (extension === 'm4a') probes.push('audio/mp4', 'audio/x-m4a');

    if (!probes.length) return false;

    return probes.some((probe) => {
      const support = audio.canPlayType(probe);
      return support === 'probably' || support === 'maybe';
    });
  }

  private async loadTextPreview(source: ResolvedFileSource): Promise<void> {
    this.loadingText = true;
    this.textError = '';
    this.textPreview = '';
    this.textTruncated = false;
    this.markViewForCheck();

    try {
      const result = source.blob
        ? await this.readTextFromBlob(source.blob, this.textPreviewMaxBytes)
        : await this.readTextFromRemote(source.url, this.textPreviewMaxBytes);

      const signature = this.detectBinarySignature(result.bytes, result.text);
      if (signature === 'office') {
        this.previewKind = 'office';
        this.preview = {
          ...this.preview,
          category: 'office',
          message: 'Archivo Office detectado.',
        };
        await this.loadOfficePreview(source);
        return;
      }
      if (signature === 'archive') {
        this.previewKind = 'archive';
        this.preview = {
          ...this.preview,
          category: 'archive',
          message: 'Archivo ZIP detectado.',
        };
        await this.loadArchivePreview(source);
        return;
      }
      if (signature === 'binary') {
        this.setUnsupportedPreview(
          'El archivo parece binario y no puede mostrarse como texto.'
        );
        return;
      }

      this.textPreview = result.text || 'Sin contenido para mostrar.';
      this.textTruncated = result.truncated;
    } catch (error: unknown) {
      this.debugError('text-preview-error', error);
      this.textError =
        'No se pudo cargar la vista previa de texto. Puedes descargar el archivo.';
    } finally {
      this.loadingText = false;
      this.markViewForCheck();
    }
  }

  private async readTextFromRemote(
    url: string,
    maxBytes: number
  ): Promise<TextLoadResult> {
    const response = await fetch(url, {
      credentials: this.shouldIncludeCredentials(url) ? 'include' : 'omit',
    });

    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    if (!response.body) {
      const fullBlob = await response.blob();
      return this.readTextFromBlob(fullBlob, maxBytes);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;

    try {
      while (total <= maxBytes) {
        const part = await reader.read();
        if (part.done) break;
        if (!part.value?.length) continue;

        const remaining = maxBytes + 1 - total;
        if (remaining <= 0) {
          truncated = true;
          break;
        }

        const chunk =
          part.value.length > remaining
            ? part.value.subarray(0, remaining)
            : part.value;

        chunks.push(chunk);
        total += chunk.length;

        if (part.value.length > remaining || total > maxBytes) {
          truncated = true;
          break;
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Ignorar errores al cancelar stream.
      }
    }

    const merged = this.concatBytes(chunks, total);
    return this.decodeTextBytes(merged, maxBytes, truncated);
  }

  private shouldIncludeCredentials(url: string): boolean {
    if (!/^https?:/i.test(url)) return false;

    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  private async readTextFromBlob(blob: Blob, maxBytes: number): Promise<TextLoadResult> {
    const sliced = blob.slice(0, maxBytes + 1);
    const buffer = await this.readBlobArrayBufferSafe(sliced);
    const bytes = new Uint8Array(buffer);
    return this.decodeTextBytes(bytes, maxBytes, blob.size > maxBytes);
  }

  private async readBlobArrayBufferSafe(blob: Blob): Promise<ArrayBuffer> {
    try {
      return await this.readBlobArrayBufferWithFileReader(blob);
    } catch {
      // Fallback si FileReader falla.
      return blob.arrayBuffer();
    }
  }

  private readBlobArrayBufferWithFileReader(blob: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('FILE_READER_ERROR'));
      reader.onabort = () => reject(new Error('FILE_READER_ABORTED'));
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }
        reject(new Error('FILE_READER_INVALID_RESULT'));
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  private decodeTextBytes(
    bytes: Uint8Array,
    maxBytes: number,
    externallyTruncated: boolean
  ): TextLoadResult {
    const localTruncated = bytes.length > maxBytes;
    const finalBytes = localTruncated ? bytes.subarray(0, maxBytes) : bytes;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = decoder.decode(finalBytes).replace(/\u0000/g, '');

    return {
      text: decoded,
      truncated: externallyTruncated || localTruncated,
      bytes: finalBytes,
    };
  }

  private detectBinarySignature(
    bytes: Uint8Array,
    decodedText: string
  ): 'office' | 'archive' | 'binary' | 'text' {
    if (!bytes.length) return 'text';

    const isPkZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (isPkZip) {
      const sample = new TextDecoder('latin1').decode(bytes.subarray(0, 96 * 1024));
      if (
        sample.includes('word/') ||
        sample.includes('word/document.xml') ||
        sample.includes('xl/') ||
        sample.includes('ppt/')
      ) {
        return 'office';
      }
      return 'archive';
    }

    let controlCount = 0;
    const sampleSize = Math.min(bytes.length, 4096);
    for (let i = 0; i < sampleSize; i++) {
      const b = bytes[i];
      if (b === 0) return 'binary';
      if (b < 9 || (b > 13 && b < 32)) controlCount++;
    }
    if (sampleSize > 0 && controlCount / sampleSize > 0.18) {
      return 'binary';
    }

    const replacementMatches = decodedText.match(/\uFFFD/g);
    const replacementCount = replacementMatches ? replacementMatches.length : 0;
    if (decodedText.length > 0 && replacementCount / decodedText.length > 0.02) {
      return 'binary';
    }

    return 'text';
  }

  private async loadOfficePreview(source: ResolvedFileSource): Promise<void> {
    this.officeLoading = true;
    this.officeError = '';
    this.officeParagraphs = [];
    this.markViewForCheck();

    try {
      const ext = String(source.extension || '').toLowerCase();
      const mime = String(source.mimeType || '').toLowerCase();

      if (ext === 'doc') {
        this.officeError =
          'La previsualizacion de .doc no esta soportada en navegador. Usa Descargar.';
        return;
      }

      const buffer = source.blob
        ? await source.blob.arrayBuffer()
        : await this.readArrayBufferFromRemote(source.url);

      const zip = await JSZip.loadAsync(buffer);
      const lowerPaths = Object.keys(zip.files).map((k) =>
        String(k || '').toLowerCase()
      );

      const isDocx =
        lowerPaths.includes('word/document.xml') ||
        lowerPaths.some((p) => p.startsWith('word/')) ||
        ext === 'docx' ||
        mime.includes('wordprocessingml');

      if (isDocx) {
        const docXmlFile = zip.file('word/document.xml');
        if (!docXmlFile) {
          this.officeError = 'No se pudo encontrar el contenido interno del DOCX.';
          return;
        }

        const xml = await docXmlFile.async('text');
        const paragraphs = this.extractDocxParagraphs(xml);
        if (!paragraphs.length) {
          this.officeError = 'No se pudo extraer texto visible del documento Word.';
          return;
        }

        const maxParagraphs = 1200;
        this.officeParagraphs = paragraphs.slice(0, maxParagraphs);
        this.preview = {
          ...this.preview,
          message: 'Vista previa de Word.',
        };
        return;
      }

      const isXlsx = lowerPaths.some((p) => p.startsWith('xl/'));
      const isPptx = lowerPaths.some((p) => p.startsWith('ppt/'));
      if (isXlsx || isPptx) {
        this.officeError =
          'La vista previa de este archivo Office no esta disponible en navegador. Usa Descargar.';
        return;
      }

      this.officeError =
        'No se pudo identificar el formato Office para previsualizarlo.';
    } catch {
      this.officeError =
        'No se pudo previsualizar este archivo Office en el navegador. Usa Descargar.';
    } finally {
      this.officeLoading = false;
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

  private concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
    const merged = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  private extractExtension(fileNameOrUrl: string): string {
    const clean = String(fileNameOrUrl || '')
      .toLowerCase()
      .split(/[?#]/)[0]
      .trim();

    if (!clean) return '';

    const leaf = clean.split('/').pop() || clean;
    const index = leaf.lastIndexOf('.');

    if (index <= 0 || index === leaf.length - 1) return '';
    return leaf.slice(index + 1);
  }

  private releaseCreatedObjectUrl(): void {
    if (!this.createdObjectUrl) return;

    try {
      URL.revokeObjectURL(this.createdObjectUrl);
    } catch {
      // Ignorar errores al limpiar object URL.
    } finally {
      this.createdObjectUrl = null;
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

  private resetTransientPreviewState(): void {
    this.preview = this.createDefaultPreview();
    this.previewKind = 'unsupported';
    this.previewUrl = '';
    this.renderError = '';
    this.textPreview = '';
    this.loadingText = false;
    this.textError = '';
    this.textTruncated = false;
    this.officeLoading = false;
    this.officeError = '';
    this.officeParagraphs = [];
    this.archiveLoading = false;
    this.archiveError = '';
    this.archiveSummary = '';
    this.archiveEntries = [];
  }

  private createDefaultPreview(): FilePreviewModel {
    return {
      category: 'unsupported',
      sourceUrl: '',
      displayName: 'Archivo',
      mimeType: '',
      extension: '',
      isHtmlText: false,
      message: 'No hay previsualizacion disponible para este archivo.',
    };
  }

  private setUnsupportedPreview(message: string): void {
    this.previewKind = 'unsupported';
    this.preview = {
      ...this.preview,
      category: 'unsupported',
      message,
    };
    this.renderError = message;
    this.markViewForCheck();
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
