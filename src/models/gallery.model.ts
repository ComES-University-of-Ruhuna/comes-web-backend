import mongoose, { Schema } from 'mongoose';

const galleryImageSchema = new Schema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  image: { type: String, required: true, maxlength: 2000 },
  isPublished: { type: Boolean, default: true, index: true },
}, { timestamps: true });

galleryImageSchema.index({ isPublished: 1, createdAt: -1, _id: -1 });

export const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);