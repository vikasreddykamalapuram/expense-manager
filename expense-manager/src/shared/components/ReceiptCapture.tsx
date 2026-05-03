import { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { receiptService } from '../services/receiptService';
import { ReceiptViewer } from './ReceiptViewer';

interface ReceiptCaptureProps {
  transactionId: string;
  receiptId?: string;
  onReceiptSaved?: (receiptId: string) => void;
  onReceiptDeleted?: () => void;
  compact?: boolean;
}

export function ReceiptCapture({
  transactionId,
  receiptId,
  onReceiptSaved,
  onReceiptDeleted,
  compact = false,
}: ReceiptCaptureProps) {
  const { state } = useAppContext();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Load thumbnail when receiptId is present
  useEffect(() => {
    if (!receiptId) {
      setThumbnailUrl(null);
      return;
    }
    let url: string | null = null;
    (async () => {
      url = await receiptService.getThumbnailUrl(receiptId);
      setThumbnailUrl(url);
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [receiptId]);

  const handleFileSelected = async (file: File) => {
    setError(null);
    const validationError = receiptService.validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    try {
      const newReceiptId = await receiptService.saveReceipt(
        state.activeProfileId,
        transactionId,
        file
      );
      onReceiptSaved?.(newReceiptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save receipt');
    } finally {
      setIsUploading(false);
      setShowOptions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!receiptId) return;
    await receiptService.deleteReceipt(receiptId);
    setThumbnailUrl(null);
    onReceiptDeleted?.();
  };

  // Has receipt — show thumbnail
  if (receiptId && thumbnailUrl) {
    return (
      <>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowViewer(true)}
            className="relative group shrink-0"
          >
            <img
              src={thumbnailUrl}
              alt="Receipt"
              className={`rounded-lg object-cover border border-gray-200 dark:border-gray-600 ${
                compact ? 'h-10 w-10' : 'h-16 w-16'
              }`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors" />
          </button>
          {!compact && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Receipt attached</span>
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-danger-600 hover:text-danger-700 transition-colors"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          )}
        </div>

        <ReceiptViewer
          receiptId={receiptId}
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          onDelete={() => {
            onReceiptDeleted?.();
            setShowViewer(false);
          }}
        />
      </>
    );
  }

  // Uploading state
  if (isUploading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 px-4 py-3">
        <Loader2 size={16} className="animate-spin text-primary-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Saving receipt...</span>
      </div>
    );
  }

  // No receipt — show add button
  return (
    <div className="relative">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={handleInputChange}
      />

      {!showOptions ? (
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400"
        >
          <Camera size={18} />
          Add Receipt
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-600 px-3 py-3 text-sm text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            <Camera size={16} />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-600 px-3 py-3 text-sm text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            <ImageIcon size={16} />
            Gallery
          </button>
          <button
            type="button"
            onClick={() => setShowOptions(false)}
            className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 px-3 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-danger-600">{error}</p>
      )}
    </div>
  );
}
