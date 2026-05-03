import { v4 as uuidv4 } from 'uuid';
import { db, DbReceipt } from './db';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const COMPRESSION_THRESHOLD = 1 * 1024 * 1024; // 1MB
const MAX_IMAGE_WIDTH = 1200;
const THUMBNAIL_WIDTH = 200;
const JPEG_QUALITY = 0.8;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}

function resizeImage(img: HTMLImageElement, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = Math.min(1, maxWidth / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compress image'));
      },
      'image/jpeg',
      quality
    );
  });
}

export const receiptService = {
  validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      return 'Unsupported file format. Please use JPEG, PNG, WebP, or HEIC.';
    }
    return null;
  },

  async saveReceipt(profileId: string, transactionId: string, file: File): Promise<string> {
    const validationError = this.validateFile(file);
    if (validationError) throw new Error(validationError);

    const id = uuidv4();
    let data: Blob = file;
    let mimeType = file.type || 'image/jpeg';

    const img = await loadImage(file);
    try {
      // Compress if over threshold
      if (file.size > COMPRESSION_THRESHOLD) {
        data = await resizeImage(img, MAX_IMAGE_WIDTH, JPEG_QUALITY);
        mimeType = 'image/jpeg';
      }

      // Generate thumbnail
      const thumbnailData = await resizeImage(img, THUMBNAIL_WIDTH, 0.7);

      const receipt: DbReceipt = {
        id,
        profileId,
        transactionId,
        data,
        mimeType,
        fileName: file.name,
        fileSize: data.size,
        thumbnailData,
        createdAt: new Date().toISOString(),
      };

      await db.receipts.add(receipt);
      return id;
    } finally {
      URL.revokeObjectURL(img.src);
    }
  },

  async getReceipt(id: string): Promise<DbReceipt | undefined> {
    return db.receipts.get(id);
  },

  async getReceiptByTransaction(transactionId: string): Promise<DbReceipt | undefined> {
    return db.receipts.where('transactionId').equals(transactionId).first();
  },

  async deleteReceipt(id: string): Promise<void> {
    await db.receipts.delete(id);
  },

  async getReceiptUrl(id: string): Promise<string | null> {
    const receipt = await db.receipts.get(id);
    if (!receipt) return null;
    return URL.createObjectURL(receipt.data);
  },

  async getThumbnailUrl(id: string): Promise<string | null> {
    const receipt = await db.receipts.get(id);
    if (!receipt?.thumbnailData) return null;
    return URL.createObjectURL(receipt.thumbnailData);
  },
};
