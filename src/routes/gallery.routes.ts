import { Router } from 'express';
import { body, query } from 'express-validator';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { getGallery, getGalleryAlbums, uploadGalleryImage, createGalleryImage, updateGalleryImage, deleteGalleryImage } from '../controllers/gallery.controller';

const router = Router();
const fields = [
  body('event').optional().isMongoId(),
  body('title').optional().isString().bail().trim().isLength({ min: 2, max: 160 }),
  body('description').optional().isString().bail().trim().isLength({ max: 1000 }),
  body('isPublished').optional().isBoolean({ strict: true }),
];

router.get('/albums', getGalleryAlbums);
router.get('/', optionalAuth, validate([
  query('event').optional().isMongoId(),
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 60 }),
  query('includeUnpublished').optional().isIn(['true', 'false']),
]), getGallery);
router.use(protect, restrictTo('admin'));
router.post('/upload', uploadGalleryImage);
router.post('/', validate([
  body('event').exists(), body('title').exists(), body('image').isString().bail().isLength({ max: 2000 }).isURL({ protocols: ['https'], require_protocol: true }).bail().custom((value: string) => new URL(value).hostname === 'res.cloudinary.com'),
  ...fields,
]), createGalleryImage);
router.patch('/:id', validate([...commonValidations.mongoId('id'), ...fields]), updateGalleryImage);
router.delete('/:id', validate(commonValidations.mongoId('id')), deleteGalleryImage);

export default router;