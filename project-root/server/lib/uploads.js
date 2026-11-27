import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './auth.js';

// Returns parse(req, res): reads a multipart form whose file fields are `fieldNames`
// (max one file each, PDFs up to 5 MB) into req.body and req.files.
export function pdfUpload(fieldNames) {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: config.maxFileBytes,
            files: fieldNames.length,
            fields: 40,
            fieldSize: 10 * 1024
        }
    }).fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

    return (req, res) => new Promise((resolve, reject) => {
        upload(req, res, (error) => {
            if (!error) {
                return resolve();
            }
            if (error instanceof multer.MulterError) {
                return reject(error.code === 'LIMIT_FILE_SIZE'
                    ? new HttpError(400, 'validation.fileTooLarge')
                    : new HttpError(400, 'validation.uploadRejected', { reason: error.message }));
            }
            reject(error);
        });
    });
}

// The uploaded file for `field`, checked to really be a PDF, or null if none was sent.
export function pdfFile(files, field) {
    const file = files?.[field]?.[0];
    if (!file) {
        return null;
    }
    // Check the bytes, not just the name/type the browser claims.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new HttpError(400, 'validation.notPdf', { name: file.originalname });
    }
    return file;
}
