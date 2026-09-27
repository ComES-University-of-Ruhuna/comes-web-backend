import { Schema, model } from 'mongoose';

const homeSlideSchema = new Schema({
  image: { type: String, required: true, maxlength: 2000 },
  altText: { type: String, required: true, trim: true, maxlength: 160 },
  order: { type: Number, default: 0, min: 0, max: 9999 },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

homeSlideSchema.index({ isPublished: 1, order: 1, _id: 1 });

export const HomeSlide = model('HomeSlide', homeSlideSchema);