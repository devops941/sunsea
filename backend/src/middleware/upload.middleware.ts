import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// In production (Vercel), filesystem is read-only - ALWAYS use memory storage
// In development, use disk storage for easier testing
const isProduction = process.env.NODE_ENV === "production";

// Helper function to ensure directory exists (only for development)
function ensureUploadDir(dir: string): void {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
        console.warn("⚠️ Could not create upload directory (using memory storage):", error);
    }
}

// Configure storage based on environment
const storage = isProduction
    ? multer.memoryStorage() // Production: Always use memory storage for Vercel
    : (() => {
          // Development: Use disk storage
          const UPLOAD_DIR = path.join(process.cwd(), "uploads", "products");
          ensureUploadDir(UPLOAD_DIR); // Create directory in dev only
          
          return multer.diskStorage({
              destination: (_req, _file, cb) => {
                  cb(null, UPLOAD_DIR);
              },
              filename: (_req, file, cb) => {
                  const ext = path.extname(file.originalname).toLowerCase();
                  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                  cb(null, `${unique}${ext}`);
              },
          });
      })();

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG, or WEBP images are allowed."));
    }
    cb(null, true);
}

export const uploadProductImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});

const ALLOWED_INVOICE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function invoiceFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (!ALLOWED_INVOICE_TYPES.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG, WEBP images, or PDF files are allowed."));
    }
    cb(null, true);
}

export const uploadInvoiceImage = multer({
    storage: multer.memoryStorage(),
    fileFilter: invoiceFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});