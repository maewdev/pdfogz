import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical, ZoomIn, RotateCw } from 'lucide-react';
import type { PdfPage } from '@/lib/pdf-utils';

interface PageThumbnailProps {
  page: PdfPage;
  index: number;
  onDelete: (id: string) => void;
  onZoom: (page: PdfPage) => void;
  onRotate: (id: string) => void;
}

export function PageThumbnail({ page, index, onDelete, onZoom, onRotate }: PageThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`page-thumbnail group relative animate-fade-in ${isDragging ? 'page-thumbnail-dragging' : ''}`}
    >
      {/* Page number badge */}
      <div className="absolute top-2 left-2 z-10 bg-foreground/80 text-background text-xs font-display font-semibold px-2 py-0.5 rounded-md">
        {index + 1}
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-1 rounded-md bg-foreground/60 text-background opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Thumbnail image */}
      <div className="p-2 pb-0">
        <img
          src={page.thumbnail}
          alt={`Page ${index + 1}`}
          className="w-full rounded-md object-contain bg-surface transition-transform duration-200"
          style={{ transform: `rotate(${page.rotation}deg)` }}
          draggable={false}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRotate(page.id)}
          className="p-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Rotate 90°"
        >
          <RotateCw size={14} />
        </button>
        <button
          onClick={() => onZoom(page)}
          className="p-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Zoom"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => onDelete(page.id)}
          className="p-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          title="Delete page"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
