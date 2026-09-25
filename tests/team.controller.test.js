jest.mock('../dist/models', () => ({ TeamMember: { find: jest.fn(), findOne: jest.fn(), findByIdAndUpdate: jest.fn() } }));
jest.mock('cloudinary', () => ({ v2: { uploader: { upload_stream: jest.fn() } } }));
jest.mock('../dist/middleware/auth.middleware', () => ({
  ...jest.requireActual('../dist/middleware/auth.middleware'),
  protect: (req, res, next) => {
    if (!req.headers['x-test-role']) return res.status(401).json({ message: 'Unauthorized' });
    req.user = { role: req.headers['x-test-role'] };
    next();
  },
}));
const { TeamMember } = require('../dist/models');
const { getAllMembers, getMember, updateMember } = require('../dist/controllers/team.controller');
const { TeamMember: TeamModel } = require('../dist/models/team.model');

const invoke = (handler, request) => new Promise((resolve) => {
  const response = { status: jest.fn().mockReturnThis(), json: (body) => resolve({ body }) };
  handler(request, response, (error) => resolve({ error }));
});

beforeEach(() => {
  jest.clearAllMocks();
  TeamMember.find.mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
});

test.each([undefined, { role: 'user' }])('public and non-admin requests cannot include inactive committee members', async (user) => {
  await invoke(getAllMembers, { query: { includeInactive: 'true', department: 'executive' }, user });
  expect(TeamMember.find).toHaveBeenCalledWith({ isActive: true, department: 'executive' });
});

test('admins can retrieve inactive committee records for editing', async () => {
  await invoke(getAllMembers, { query: { includeInactive: 'true' }, user: { role: 'admin' } });
  expect(TeamMember.find).toHaveBeenCalledWith({});
});

test('admin requests default to the public active-only list', async () => {
  await invoke(getAllMembers, { query: {}, user: { role: 'admin' } });
  expect(TeamMember.find).toHaveBeenCalledWith({ isActive: true });
});

test('public detail requests hide inactive members', async () => {
  TeamMember.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
  const { error } = await invoke(getMember, { params: { id: 'member-1' } });
  expect(TeamMember.findOne).toHaveBeenCalledWith({ _id: 'member-1', isActive: true });
  expect(error.statusCode).toBe(404);
});

test('committee updates validate and return the saved contact details', async () => {
  const changes = { name: 'Updated President', role: 'President', contactNo: '+94701117791', avatar: '', linkedin: '', isActive: false };
  TeamMember.findByIdAndUpdate.mockResolvedValue({ _id: 'member-1', ...changes });
  const { body } = await invoke(updateMember, { params: { id: 'member-1' }, body: changes });
  expect(TeamMember.findByIdAndUpdate).toHaveBeenCalledWith('member-1', changes, { new: true, runValidators: true });
  expect(body.data.member).toMatchObject(changes);
});

test('the committee schema persists phone numbers', () => {
  const member = new TeamModel({ contactNo: ' +94701117791 ' });
  expect(member.contactNo).toBe('+94701117791');
});

describe('committee avatar uploads', () => {
  const express = require('express');
  const { v2: cloudinary } = require('cloudinary');
  const config = require('../dist/config').default;
  const originalConfig = { ...config.cloudinary };
  let server;
  let endpoint;
  beforeAll(async () => {
    const app = express();
    app.use('/team', require('../dist/routes/team.routes').default);
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    endpoint = `http://127.0.0.1:${server.address().port}/team/avatar`;
  });
  beforeEach(() => {
    config.cloudinary = { cloudName: 'test-cloud', apiKey: 'test-key', apiSecret: 'test-secret' };
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({ end: () => callback(null, { secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/photo.png' }) }));
  });
  afterAll(async () => {
    config.cloudinary = originalConfig;
    await new Promise(resolve => server.close(resolve));
  });
  const upload = (role = 'admin', type = 'image/png', bytes = 10) => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.alloc(bytes)], { type }), 'photo.png');
    return fetch(endpoint, { method: 'POST', headers: role ? { 'x-test-role': role } : {}, body: form });
  };
  test.each([[undefined, 401], ['student', 403], ['moderator', 403]])('denies uploads for %s', async (role, code) => {
    const response = await upload(role || '');
    expect(response.status).toBe(code);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
  test('uploads an image to the fixed Cloudinary folder and returns its secure URL', async () => {
    const response = await upload();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: { url: 'https://res.cloudinary.com/test-cloud/image/upload/photo.png' } });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ resource_type: 'image', folder: 'comes/team', allowed_formats: ['jpg', 'png', 'webp'] }), expect.any(Function));
  });
  test.each([['image/svg+xml', 10], ['image/png', 3 * 1024 * 1024 + 1]])('rejects unsupported or oversized files', async (type, bytes) => {
    expect((await upload('admin', type, bytes)).status).toBe(400);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
  test('reports missing configuration without sending a file to Cloudinary', async () => {
    config.cloudinary.apiSecret = '';
    expect((await upload()).status).toBe(503);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
  test('rejects missing files', async () => {
    expect((await fetch(endpoint, { method: 'POST', headers: { 'x-test-role': 'admin' } })).status).toBe(400);
  });
  test('does not leak provider errors', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({ end: () => callback({ http_code: 500, message: 'provider secret' }) }));
    const response = await upload();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Image upload failed. Please try again.' });
  });
});