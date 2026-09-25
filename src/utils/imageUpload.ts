import { Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import config from '../config';
import { AppError } from './errors';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError('Choose a JPEG, PNG, or WebP image.', 400));
      return;
    }
    callback(null, true);
  },
}).single('image');

export const uploadImage = async (
  req: Request,
  res: Response,
  folder: 'comes/team' | 'comes/events' | 'comes/gallery' | 'comes/profiles'
): Promise<string> => {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError('Image uploads are not configured. Contact the site administrator.', 503);
  }
  await new Promise<void>((resolve, reject) => {
    imageUpload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        reject(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 3 MB or smaller.' : 'Upload one image file only.', 400));
      } else if (error) {
        reject(error instanceof AppError ? error : new AppError('Invalid image upload.', 400));
      } else {
        resolve();
      }
    });
  });
  if (!req.file) throw new AppError('Choose an image to upload.', 400);
  const buffer = req.file.buffer;
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      resource_type: 'image',
      folder,
      allowed_formats: ['jpg', 'png', 'webp'],
      timeout: 60000,
    }, (error, result) => {
      if (error || !result?.secure_url) {
        reject(new AppError(error?.http_code === 400 ? 'The file is not a supported image.' : 'Image upload failed. Please try again.', error?.http_code === 400 ? 400 : 502));
      } else {
        resolve(result.secure_url);
      }
    });
    stream.end(buffer);
  });
};