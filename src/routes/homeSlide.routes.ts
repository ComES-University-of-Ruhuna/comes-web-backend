import { Router } from 'express';
import { body } from 'express-validator';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { getHomeSlides, getAdminHomeSlides, uploadHomeSlide, createHomeSlide, updateHomeSlide, deleteHomeSlide } from '../controllers/homeSlide.controller';

const router = Router();
const fields = [
  body('altText').optional().isString().bail().trim().isLength({ min: 1, max: 160 }),
  body('order').optional().isInt({ min: 0, max: 9999 }),
  body('isPublished').optional().isBoolean({ strict: true }),
];

router.get('/', getHomeSlides);
router.use(protect, restrictTo('admin'));
router.get('/admin', getAdminHomeSlides);
router.post('/upload', uploadHomeSlide);
router.post('/', validate([
  body('altText').exists(),
  body('image').isString().bail().isLength({ max: 2000 }).isURL({ protocols: ['https'], require_protocol: true }).bail().custom((value: string) => new URL(value).hostname === 'res.cloudinary.com'),
  ...fields,
]), createHomeSlide);
router.patch('/:id', validate([...commonValidations.mongoId('id'), ...fields]), updateHomeSlide);
router.delete('/:id', validate(commonValidations.mongoId('id')), deleteHomeSlide);

export default router;