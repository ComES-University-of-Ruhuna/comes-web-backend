import { HomeSlide } from '../models/homeSlide.model';
import { asyncHandler, NotFoundError } from '../utils';
import { uploadImage } from '../utils/imageUpload';

export const getHomeSlides = asyncHandler(async (_req, res) => {
  const slides = await HomeSlide.find({ isPublished: true }).select('image altText order').sort({ order: 1, _id: 1 });
  res.json({ success: true, data: { slides } });
});

export const getAdminHomeSlides = asyncHandler(async (_req, res) => {
  const slides = await HomeSlide.find({}).sort({ order: 1, _id: 1 });
  res.json({ success: true, data: { slides } });
});

export const uploadHomeSlide = asyncHandler(async (req, res) => {
  const url = await uploadImage(req, res, 'comes/homepage');
  res.status(201).json({ success: true, data: { url } });
});

export const createHomeSlide = asyncHandler(async (req, res) => {
  const { image, altText, order, isPublished } = req.body;
  const slide = await HomeSlide.create({ image, altText, order, isPublished });
  res.status(201).json({ success: true, data: { slide } });
});

export const updateHomeSlide = asyncHandler(async (req, res) => {
  const changes: Record<string, unknown> = {};
  for (const field of ['altText', 'order', 'isPublished']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }
  const slide = await HomeSlide.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
  if (!slide) throw new NotFoundError('Homepage slide');
  res.json({ success: true, data: { slide } });
});

export const deleteHomeSlide = asyncHandler(async (req, res) => {
  if (!(await HomeSlide.findByIdAndDelete(req.params.id))) throw new NotFoundError('Homepage slide');
  res.status(204).send();
});