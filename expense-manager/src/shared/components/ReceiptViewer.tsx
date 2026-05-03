import { useState, useEffect } from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { receiptService } from '../services/receiptService';
import { Button } from './ui/Button';

interface ReceiptViewerProps {
  receiptId: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

export function ReceiptViewer({ receiptId, isOpen, onClose, onDelete }: ReceiptViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('receipt');

  useEffect(() => {
    if (!isOpen || !receiptId) return;

    let url: string | null = null;
    (async () => {
      const receipt = await receiptService.getReceipt(receiptId);
      if (receipt) {
        url = URL.createObjectURL(receipt.data);
        setImageUrl(url);
        setFileName(receipt.fileName);
      }
    })();

    return () => {
      if (url) URL.revokeObjectURL(url);
      setImageUrl(null);
    };
  }, [isOpen, receiptId]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    a.click();
  };

  const handleDelete = async () => {
    await receiptService.deleteReceipt(receiptId);
    onDelete?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <h3 className="text-sm font-medium text-white truncate">{fileName}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
            icon={<Download size={16} />}
          >
            Save
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-danger-400 hover:bg-white/20"
              icon={<Trash2 size={16} />}
            >
              Delete
            </Button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        style={{ touchAction: 'pinch-zoom' }}
        onClick={onClose}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Receipt"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-white/60 text-sm">Loading receipt...</div>
        )}
      </div>
    </div>
  );
}
