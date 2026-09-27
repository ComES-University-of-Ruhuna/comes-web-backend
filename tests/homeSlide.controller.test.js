jest.mock('../dist/models/homeSlide.model', () => ({ HomeSlide: { find: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() } }));
jest.mock('../dist/utils/imageUpload', () => ({ uploadImage: jest.fn() }));
jest.mock('../dist/middleware/auth.middleware', () => ({
  ...jest.requireActual('../dist/middleware/auth.middleware'),
  protect: (req, res, next) => { if (!req.headers['x-test-role']) return res.status(401).json({ message: 'Unauthorized' }); req.user = { role: req.headers['x-test-role'] }; next(); },
}));
const express = require('express');
const { HomeSlide } = require('../dist/models/homeSlide.model');
const { uploadImage } = require('../dist/utils/imageUpload');
const id = '507f1f77bcf86cd799439011';
const fields = { image: 'https://res.cloudinary.com/comes/image/upload/hero.jpg', altText: 'ComES workshop', order: 2, isPublished: false };
let server;
let endpoint;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/homepage-slides', require('../dist/routes/homeSlide.routes').default);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  endpoint = `http://127.0.0.1:${server.address().port}/homepage-slides`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  jest.resetAllMocks();
  HomeSlide.find.mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) });
  HomeSlide.create.mockResolvedValue({ _id: id, ...fields });
  HomeSlide.findByIdAndUpdate.mockResolvedValue({ _id: id, ...fields });
  HomeSlide.findByIdAndDelete.mockResolvedValue({ _id: id });
  uploadImage.mockResolvedValue(fields.image);
});
const request = (path = '', method = 'GET', body, role = '') => fetch(endpoint + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

test('public list only includes published slides in stable display order', async () => {
  expect((await request('?includeUnpublished=true')).status).toBe(200);
  expect(HomeSlide.find).toHaveBeenCalledWith({ isPublished: true });
  expect(HomeSlide.find.mock.results[0].value.select).toHaveBeenCalledWith('image altText order');
  expect(HomeSlide.find.mock.results[0].value.sort).toHaveBeenCalledWith({ order: 1, _id: 1 });
});
test.each([['', 401], ['student', 403], ['moderator', 403]])('management requires admin access for %s', async (role, code) => {
  for (const [path, method] of [['/admin', 'GET'], ['', 'POST'], ['/upload', 'POST'], [`/${id}`, 'PATCH'], [`/${id}`, 'DELETE']]) expect((await request(path, method, method === 'GET' ? undefined : fields, role)).status).toBe(code);
  expect(uploadImage).not.toHaveBeenCalled();
  expect(HomeSlide.create).not.toHaveBeenCalled();
});
test('admins can list drafts and upload via the shared image helper', async () => {
  expect((await request('/admin', 'GET', undefined, 'admin')).status).toBe(200);
  expect(HomeSlide.find).toHaveBeenCalledWith({});
  const response = await request('/upload', 'POST', undefined, 'admin');
  expect(response.status).toBe(201);
  expect((await response.json()).data.url).toBe(fields.image);
  expect(uploadImage).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'comes/homepage');
});
test('creates only allowlisted metadata', async () => {
  expect((await request('', 'POST', { ...fields, createdAt: '2000-01-01' }, 'admin')).status).toBe(201);
  expect(HomeSlide.create).toHaveBeenCalledWith(fields);
});
test.each([{ altText: '' }, { altText: null }, { image: 'javascript:alert(1)' }, { image: 'https://example.com/photo.jpg' }, { order: -1 }, { order: 1.5 }, { isPublished: 'false' }])('rejects invalid metadata %j', async invalid => {
  expect((await request('', 'POST', { ...fields, ...invalid }, 'admin')).status).toBe(400);
  expect(HomeSlide.create).not.toHaveBeenCalled();
});
test('updates only editable metadata and handles missing records', async () => {
  expect((await request(`/${id}`, 'PATCH', { altText: 'New description', order: 4, isPublished: true, image: 'ignored' }, 'admin')).status).toBe(200);
  expect(HomeSlide.findByIdAndUpdate).toHaveBeenCalledWith(id, { $set: { altText: 'New description', order: 4, isPublished: true } }, { new: true, runValidators: true });
  HomeSlide.findByIdAndUpdate.mockResolvedValue(null);
  expect((await request(`/${id}`, 'PATCH', { order: 1 }, 'admin')).status).toBe(404);
});
test('deletes slides without deleting shared cloud assets', async () => {
  expect((await request(`/${id}`, 'DELETE', undefined, 'admin')).status).toBe(204);
  HomeSlide.findByIdAndDelete.mockResolvedValue(null);
  expect((await request(`/${id}`, 'DELETE', undefined, 'admin')).status).toBe(404);
  expect((await request('/invalid', 'DELETE', undefined, 'admin')).status).toBe(400);
});