import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Use the bundled worker from the same installed pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfPage {
  id: string;
  pageIndex: number;
  sourceFileIndex: number;
  thumbnail: string;
  width: number;
  height: number;
  rotation: number; // extra rotation in degrees (0, 90, 180, 270)
}

export interface PdfFile {
  name: string;
  data: Uint8Array;
  pageCount: number;
}

export async function loadPdfFile(file: File): Promise<{ pdfFile: PdfFile; pages: PdfPage[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const pdfDoc = await pdfjsLib.getDocument({ data: data.slice() }).promise;
  const pageCount = pdfDoc.numPages;
  
  const pages: PdfPage[] = [];
  
  for (let i = 0; i < pageCount; i++) {
    const page = await pdfDoc.getPage(i + 1);
    const viewport = page.getViewport({ scale: 0.5 });
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    
    pages.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      pageIndex: i,
      sourceFileIndex: 0,
      thumbnail: canvas.toDataURL('image/jpeg', 0.6),
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
    });
    
    canvas.remove();
  }
  
  pdfDoc.destroy();
  
  return {
    pdfFile: { name: file.name, data, pageCount },
    pages,
  };
}

export async function renderPageHighRes(
  fileData: Uint8Array,
  pageIndex: number,
  scale: number = 2
): Promise<string> {
  const pdfDoc = await pdfjsLib.getDocument({ data: fileData.slice() }).promise;
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  const dataUrl = canvas.toDataURL('image/png');
  canvas.remove();
  pdfDoc.destroy();
  
  return dataUrl;
}

function applyRotation(copiedPage: { getRotation: () => { angle: number }; setRotation: (r: ReturnType<typeof degrees>) => void }, rotation: number) {
  if (rotation % 360 === 0) return;
  const current = copiedPage.getRotation().angle;
  copiedPage.setRotation(degrees((current + rotation) % 360));
}

export async function buildPdf(
  sourceFiles: PdfFile[],
  pages: PdfPage[]
): Promise<Uint8Array> {
  const newPdf = await PDFDocument.create();
  
  // Group pages by source file for efficiency
  const loadedDocs: Map<number, Awaited<ReturnType<typeof PDFDocument.load>>> = new Map();
  
  for (const page of pages) {
    if (!loadedDocs.has(page.sourceFileIndex)) {
      const doc = await PDFDocument.load(sourceFiles[page.sourceFileIndex].data);
      loadedDocs.set(page.sourceFileIndex, doc);
    }
    
    const sourceDoc = loadedDocs.get(page.sourceFileIndex)!;
    const [copiedPage] = await newPdf.copyPages(sourceDoc, [page.pageIndex]);
    applyRotation(copiedPage, page.rotation);
    newPdf.addPage(copiedPage);
  }
  
  return newPdf.save();
}

export type CompressQuality = 'low' | 'medium' | 'high';

const QUALITY_PRESETS: Record<CompressQuality, { dpi: number; jpeg: number }> = {
  low: { dpi: 96, jpeg: 0.5 },    // smallest size, readable
  medium: { dpi: 120, jpeg: 0.65 }, // balanced
  high: { dpi: 150, jpeg: 0.8 },   // best quality, larger size
};

/**
 * High-ratio compression: rasterizes each page to JPEG at a controlled DPI
 * and rebuilds the PDF from those images. Typically 70-95% smaller than the
 * original. Lossy — best for documents meant for viewing/sharing.
 */
export async function compressPdf(
  sourceFiles: PdfFile[],
  pages: PdfPage[],
  quality: CompressQuality = 'medium',
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const { dpi, jpeg } = QUALITY_PRESETS[quality];
  const scale = dpi / 72; // PDF points are 1/72 inch

  const newPdf = await PDFDocument.create();
  const loadedDocs: Map<number, Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>> = new Map();

  let done = 0;
  for (const page of pages) {
    if (!loadedDocs.has(page.sourceFileIndex)) {
      loadedDocs.set(
        page.sourceFileIndex,
        await pdfjsLib.getDocument({ data: sourceFiles[page.sourceFileIndex].data.slice() }).promise
      );
    }
    const doc = loadedDocs.get(page.sourceFileIndex)!;
    const pdfjsPage = await doc.getPage(page.pageIndex + 1);

    const baseViewport = pdfjsPage.getViewport({ scale: 1 });
    const viewport = pdfjsPage.getViewport({ scale, rotation: (pdfjsPage.rotate + page.rotation) % 360 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await pdfjsPage.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const jpegDataUrl = canvas.toDataURL('image/jpeg', jpeg);
    const image = await newPdf.embedJpg(jpegDataUrl);
    canvas.remove();

    // Page size in points, accounting for rotation
    const rotated = (pdfjsPage.rotate + page.rotation) % 180 !== 0;
    const w = rotated ? baseViewport.height : baseViewport.width;
    const h = rotated ? baseViewport.width : baseViewport.height;
    const newPage = newPdf.addPage([w, h]);
    newPage.drawImage(image, { x: 0, y: 0, width: w, height: h });

    done++;
    onProgress?.(done, pages.length);
  }

  for (const doc of loadedDocs.values()) doc.destroy();

  return newPdf.save({ useObjectStreams: true, addDefaultPage: false });
}

export function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
