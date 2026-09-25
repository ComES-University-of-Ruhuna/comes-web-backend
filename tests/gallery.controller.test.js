jest.mock('../dist/models/gallery.model', () => ({ GalleryImage: { find: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() } }));
jest.mock('../dist/models', () => ({ Event: { exists: jest.fn() } }));
jest.mock('../dist/utils/imageUpload', () => ({ uploadImage: jest.fn() }));
jest.mock('../dist/middleware/auth.middleware', () => ({
  ...jest.requireActual('../dist/middleware/auth.middleware'),
  optionalAuth: (req, res, next) => { if (req.headers['x-test-role']) req.user = { role: req.headers['x-test-role'] }; next(); },
  protect: (req, res, next) => { if (!req.headers['x-test-role']) return res.status(401).json({ message: 'Unauthorized' }); req.user = { role: req.headers['x-test-role'] }; next(); },
}));
const express = require('express');
const { GalleryImage } = require('../dist/models/gallery.model');
const { Event } = require('../dist/models');
const { uploadImage } = require('../dist/utils/imageUpload');
const id = '507f1f77bcf86cd799439011';
const fields = { event: id, title: 'Workshop highlights', image: 'https://res.cloudinary.com/comes/image/upload/gallery.jpg' };
let server;
let endpoint;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/gallery', require('../dist/routes/gallery.routes').default);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  endpoint = `http://127.0.0.1:${server.address().port}/gallery`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  jest.resetAllMocks();
  const chain = { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
  GalleryImage.find.mockReturnValue(chain);
  GalleryImage.countDocuments.mockResolvedValue(0);
  GalleryImage.aggregate.mockResolvedValue([]);
  Event.exists.mockResolvedValue({ _id: id });
  GalleryImage.create.mockResolvedValue({ _id: id, ...fields, populate: jest.fn().mockResolvedValue(undefined) });
  GalleryImage.findByIdAndUpdate.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: id, ...fields }) });
  uploadImage.mockResolvedValue(fields.image);
});
const request = (path = '', method = 'GET', body, role = '') => fetch(endpoint + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

test.each(['', 'student', 'moderator'])('public gallery cannot expose unpublished images for %s', async role => {
  expect((await request('?includeUnpublished=true', 'GET', undefined, role)).status).toBe(200);
  expect(GalleryImage.find).toHaveBeenCalledWith({ isPublished: true });
  expect(GalleryImage.countDocuments).toHaveBeenCalledWith({ isPublished: true });
});
test('admin can list drafts with bounded pagination and event filtering', async () => {
  await request(`?includeUnpublished=true&event=${id}&page=2&limit=12`, 'GET', undefined, 'admin');
  expect(GalleryImage.find).toHaveBeenCalledWith({ event: id });
  expect(GalleryImage.find.mock.results[0].value.skip).toHaveBeenCalledWith(12);
});
test.each(['?page=0', '?limit=999', '?event=invalid'])('rejects invalid public filters %s', async path => {
  expect((await request(path)).status).toBe(400);
  expect(GalleryImage.find).not.toHaveBeenCalled();
});
test('albums count published images only and project public event fields', async () => {
  expect((await request('/albums')).status).toBe(200);
  const pipeline = GalleryImage.aggregate.mock.calls[0][0];
  expect(pipeline[0]).toEqual({ $match: { isPublished: true } });
  expect(pipeline.at(-1).$project).toEqual({ _id: 1, count: 1, title: '$event.title', slug: '$event.slug', date: '$event.date' });
});
test.each([['', 401], ['student', 403], ['moderator', 403]])('gallery writes require admin access for %s', async (role, code) => {
  for (const [path, method] of [['', 'POST'], ['/upload', 'POST'], [`/${id}`, 'PATCH'], [`/${id}`, 'DELETE']]) expect((await request(path, method, fields, role)).status).toBe(code);
  expect(uploadImage).not.toHaveBeenCalled();
  expect(GalleryImage.create).not.toHaveBeenCalled();
});
test('uploads through the shared Cloudinary helper into the gallery folder', async () => {
  const response = await request('/upload', 'POST', undefined, 'admin');
  expect(response.status).toBe(201);
  expect((await response.json()).data.url).toBe(fields.image);
  expect(uploadImage).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'comes/gallery');
});
test('creates event-linked metadata and ignores privileged extra fields', async () => {
  expect((await request('', 'POST', { ...fields, isPublished: false, createdAt: '2000-01-01' }, 'admin')).status).toBe(201);
  expect(GalleryImage.create).toHaveBeenCalledWith({ ...fields, description: undefined, isPublished: false });
});
test.each([{ title: '' }, { image: 'javascript:alert(1)' }, { image: 'https://example.com/photo.jpg' }, { isPublished: 'false' }, { event: 'invalid' }])('rejects invalid gallery metadata %j', async invalid => {
  expect((await request('', 'POST', { ...fields, ...invalid }, 'admin')).status).toBe(400);
  expect(GalleryImage.create).not.toHaveBeenCalled();
});
test('rejects missing events and missing gallery records', async () => {
  Event.exists.mockResolvedValue(null);
  expect((await request('', 'POST', fields, 'admin')).status).toBe(404);
  GalleryImage.findByIdAndUpdate.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
  expect((await request(`/${id}`, 'PATCH', { title: 'Updated' }, 'admin')).status).toBe(404);
});
test('updates only editable metadata and removes records without deleting shared assets', async () => {
  await request(`/${id}`, 'PATCH', { title: 'Updated', isPublished: false, image: 'ignored', createdAt: 'ignored' }, 'admin');
  expect(GalleryImage.findByIdAndUpdate).toHaveBeenCalledWith(id, { $set: { title: 'Updated', isPublished: false } }, { new: true, runValidators: true });
  GalleryImage.findByIdAndDelete.mockResolvedValue({ _id: id });
  expect((await request(`/${id}`, 'DELETE', undefined, 'admin')).status).toBe(204);
  GalleryImage.findByIdAndDelete.mockResolvedValue(null);
  expect((await request(`/${id}`, 'DELETE', undefined, 'admin')).status).toBe(404);
});