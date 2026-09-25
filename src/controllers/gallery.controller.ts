import { GalleryImage } from '../models/gallery.model';
import { Event } from '../models';
import { asyncHandler, NotFoundError } from '../utils';
import { uploadImage } from '../utils/imageUpload';

const eventFields = 'title slug date type';

export const getGallery = asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.user?.role !== 'admin' || req.query.includeUnpublished !== 'true') filter.isPublished = true;
  if (req.query.event) filter.event = req.query.event;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 24;
  const [images, total] = await Promise.all([
    GalleryImage.find(filter).populate('event', eventFields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    GalleryImage.countDocuments(filter),
  ]);
  res.json({ success: true, data: { images, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

export const getGalleryAlbums = asyncHandler(async (_req, res) => {
  const albums = await GalleryImage.aggregate([
    { $match: { isPublished: true } },
    { $group: { _id: '$event', count: { $sum: 1 } } },
    { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $sort: { 'event.date': -1, _id: -1 } },
    { $project: { _id: 1, count: 1, title: '$event.title', slug: '$event.slug', date: '$event.date' } },
  ]);
  res.json({ success: true, data: { albums } });
});

export const uploadGalleryImage = asyncHandler(async (req, res) => {
  const url = await uploadImage(req, res, 'comes/gallery');
  res.status(201).json({ success: true, data: { url } });
});

export const createGalleryImage = asyncHandler(async (req, res) => {
  const { event, title, description, image, isPublished } = req.body;
  if (!(await Event.exists({ _id: event }))) throw new NotFoundError('Event');
  const record = await GalleryImage.create({ event, title, description, image, isPublished });
  await record.populate('event', eventFields);
  res.status(201).json({ success: true, data: { image: record } });
});

export const updateGalleryImage = asyncHandler(async (req, res) => {
  const changes: Record<string, unknown> = {};
  for (const field of ['event', 'title', 'description', 'isPublished']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }
  if (changes.event && !(await Event.exists({ _id: changes.event }))) throw new NotFoundError('Event');
  const image = await GalleryImage.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true }).populate('event', eventFields);
  if (!image) throw new NotFoundError('Gallery image');
  res.json({ success: true, data: { image } });
});

export const deleteGalleryImage = asyncHandler(async (req, res) => {
  if (!(await GalleryImage.findByIdAndDelete(req.params.id))) throw new NotFoundError('Gallery image');
  res.status(204).send();
});