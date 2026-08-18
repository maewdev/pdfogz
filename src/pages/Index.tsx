import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Download, Minimize2, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DropZone } from '@/components/DropZone';
import { PageThumbnail } from '@/components/PageThumbnail';
import { ZoomModal } from '@/components/ZoomModal';
import {
  loadPdfFile,
  buildPdf,
  compressPdf,
  downloadBlob,
  formatFileSize,
  type PdfPage,
  type PdfFile,
} from '@/lib/pdf-utils';

const Index = () => {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [sourceFiles, setSourceFiles] = useState<PdfFile[]>([]);
  const [zoomPage, setZoomPage] = useState<PdfPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFilesSelected = useCallback(async (files: FileList) => {
    setLoading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') {
          toast.error(`"${file.name}" is not a PDF`);
          continue;
        }
        const { pdfFile, pages: newPages } = await loadPdfFile(file);
        
        setSourceFiles(prev => {
          const newIndex = prev.length;
          // Update source file index for new pages
          const adjustedPages = newPages.map(p => ({ ...p, sourceFileIndex: newIndex }));
          setPages(prevPages => [...prevPages, ...adjustedPages]);
          return [...prev, pdfFile];
        });
        
        toast.success(`Added "${file.name}" (${newPages.length} pages)`);
      }
    } catch (err) {
      toast.error('Failed to load PDF');
      console.error(err);
    }
    setLoading(false);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id);
        const newIndex = prev.findIndex(p => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
    toast('Page removed');
  }, []);

  const handleDeleteAll = useCallback(() => {
    setPages([]);
    setSourceFiles([]);
    toast('All pages cleared');
  }, []);

  const generateRandomFilename = useCallback((base: string) => {
    const id = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return `${base}-${id}.pdf`;
  }, []);

  const handleSave = useCallback(async () => {
    if (pages.length === 0) return;
    setProcessing(true);
    try {
      const data = await buildPdf(sourceFiles, pages);
      downloadBlob(data, generateRandomFilename('organized'));
      toast.success(`Saved! (${formatFileSize(data.length)})`);
    } catch (err) {
      toast.error('Failed to save PDF');
      console.error(err);
    }
    setProcessing(false);
  }, [pages, sourceFiles, generateRandomFilename]);

  const handleCompress = useCallback(async () => {
    if (pages.length === 0) return;
    setProcessing(true);
    try {
      const data = await compressPdf(sourceFiles, pages);
      downloadBlob(data, generateRandomFilename('compressed'));
      toast.success(`Compressed! (${formatFileSize(data.length)})`);
    } catch (err) {
      toast.error('Failed to compress PDF');
      console.error(err);
    }
    setProcessing(false);
  }, [pages, sourceFiles, generateRandomFilename]);

  const totalOriginalSize = sourceFiles.reduce((sum, f) => sum + f.data.length, 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-toolbar border-b border-border/20">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText size={16} className="text-primary-foreground" />
            </div>
            <h1 className="text-toolbar-foreground text-lg font-bold tracking-tight">
              PDF Organizer
            </h1>
            {pages.length > 0 && (
              <span className="text-xs text-muted-foreground bg-secondary/20 px-2 py-0.5 rounded-full font-medium">
                {pages.length} pages • {formatFileSize(totalOriginalSize)}
              </span>
            )}
          </div>

          {pages.length > 0 && (
            <div className="flex items-center gap-2">
              <DropZone onFilesSelected={handleFilesSelected} hasPages />
              <button
                onClick={handleCompress}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/20 text-toolbar-foreground hover:bg-secondary/30 transition-colors font-display font-medium text-sm disabled:opacity-50"
              >
                <Minimize2 size={16} />
                Compress
              </button>
              <button
                onClick={handleSave}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-display font-semibold text-sm disabled:opacity-50"
              >
                <Download size={16} />
                {processing ? 'Processing...' : 'Save PDF'}
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-2 p-2 rounded-lg text-toolbar-foreground/60 hover:bg-destructive/20 hover:text-destructive transition-colors"
                title="Clear all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-muted-foreground font-medium">Loading PDF...</span>
          </div>
        )}

        {!loading && pages.length === 0 && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <DropZone onFilesSelected={handleFilesSelected} hasPages={false} />
          </div>
        )}

        {pages.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                {pages.map((page, index) => (
                  <PageThumbnail
                    key={page.id}
                    page={page}
                    index={index}
                    onDelete={handleDelete}
                    onZoom={setZoomPage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {/* Zoom modal */}
      {zoomPage && (
        <ZoomModal
          page={zoomPage}
          sourceFiles={sourceFiles}
          onClose={() => setZoomPage(null)}
        />
      )}
    </div>
  );
};

export default Index;
