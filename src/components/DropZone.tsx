import { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: FileList) => void;
  hasPages: boolean;
}

export function DropZone({ onFilesSelected, hasPages }: DropZoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  }, [onFilesSelected]);

  if (hasPages) {
    return (
      <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer font-display font-medium text-sm">
        <Upload size={16} />
        Add PDF
        <input type="file" accept=".pdf" multiple onChange={handleChange} className="hidden" />
      </label>
    );
  }

  return (
    <label
      className="flex flex-col items-center justify-center w-full max-w-lg mx-auto p-16 border-2 border-dashed border-border rounded-2xl bg-surface hover:bg-surface-hover hover:border-primary/40 transition-all cursor-pointer group"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <FileText size={28} className="text-primary" />
      </div>
      <p className="text-lg font-display font-semibold text-foreground mb-1">
        Drop PDF files here
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        or click to browse
      </p>
      <div className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm group-hover:shadow-lg transition-shadow">
        Select Files
      </div>
      <input type="file" accept=".pdf" multiple onChange={handleChange} className="hidden" />
    </label>
  );
}
