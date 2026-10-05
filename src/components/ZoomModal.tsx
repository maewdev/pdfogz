import { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import type { PdfPage, PdfFile } from '@/lib/pdf-utils';
import { renderPageHighRes } from '@/lib/pdf-utils';

interface ZoomModalProps {
  page: PdfPage;
  sourceFiles: PdfFile[];
  onClose: () => void;
}

export function ZoomModal({ page, sourceFiles, onClose }: ZoomModalProps) {
  const [highResImage, setHighResImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const file = sourceFiles[page.sourceFileIndex];
    if (!file) return;
    
    setLoading(true);
    renderPageHighRes(file.data, page.pageIndex, 3).then((img) => {
      setHighResImage(img);
      setLoading(false);
    });
  }, [page, sourceFiles]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 5));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/80 flex items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.25)); }}
          className="p-2 rounded-lg bg-card text-card-foreground hover:bg-secondary transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <span className="flex items-center px-3 rounded-lg bg-card text-card-foreground text-sm font-display font-semibold min-w-[60px] justify-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 5)); }}
          className="p-2 rounded-lg bg-card text-card-foreground hover:bg-secondary transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(1); }}
          className="p-2 rounded-lg bg-card text-card-foreground hover:bg-secondary transition-colors"
        >
          <RotateCw size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-card text-card-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="overflow-auto max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center w-64 h-64">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <img
            src={highResImage || page.thumbnail}
            alt="Zoomed page"
            style={{ transform: `scale(${zoom}) rotate(${page.rotation}deg)`, transformOrigin: 'center center' }}
            className="transition-transform duration-200 rounded-lg shadow-2xl"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
