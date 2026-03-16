import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { version } from 'pdfjs-dist';

// Set worker to match installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

export interface PdfPage {
  id: string;
  pageIndex: number;
  sourceFileIndex: number;
  thumbnail: string;
  width: number;
  height: number;
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
  
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  canvas.remove();
  pdfDoc.destroy();
  
  return dataUrl;
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
    newPdf.addPage(copiedPage);
  }
  
  return newPdf.save();
}

export async function compressPdf(
  sourceFiles: PdfFile[],
  pages: PdfPage[]
): Promise<Uint8Array> {
  // Build PDF with compression options
  const newPdf = await PDFDocument.create();
  
  const loadedDocs: Map<number, Awaited<ReturnType<typeof PDFDocument.load>>> = new Map();
  
  for (const page of pages) {
    if (!loadedDocs.has(page.sourceFileIndex)) {
      const doc = await PDFDocument.load(sourceFiles[page.sourceFileIndex].data);
      loadedDocs.set(page.sourceFileIndex, doc);
    }
    
    const sourceDoc = loadedDocs.get(page.sourceFileIndex)!;
    const [copiedPage] = await newPdf.copyPages(sourceDoc, [page.pageIndex]);
    newPdf.addPage(copiedPage);
  }
  
  // Save with object streams for better compression
  return newPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
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
