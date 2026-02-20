import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// File upload validation
export const ALLOWED_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateUploadFile(file: File): void {
  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    throw new Error('Fichier trop volumineux (max 10 MB)');
  }
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new Error('Type de fichier non autorisé (JPG, PNG, WebP, PDF uniquement)');
  }
}
