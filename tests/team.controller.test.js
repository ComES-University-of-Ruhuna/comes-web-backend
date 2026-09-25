jest.mock('../dist/models', () => ({ TeamMember: { find: jest.fn(), findOne: jest.fn(), findByIdAndUpdate: jest.fn() } }));
jest.mock('cloudinary', () => ({ v2: { uploader: { upload_stream: jest.fn() } } }));
jest.mock('../dist/models/student.model', () => ({ Student: { findByIdAndUpdate: jest.fn() } }));
jest.mock('../dist/middleware/auth.middleware', () => ({
  ...jest.requireActual('../dist/middleware/auth.middleware'),
  protectStudent: (req, res, next) => {
    if (!req.headers['x-test-student']) return res.status(401).json({ message: 'Unauthorized' });
    req.student = { _id: req.headers['x-test-student'] };
    next();
  },
  protect: (req, res, next) => {
    if (!req.headers['x-test-role']) return res.status(401).json({ message: 'Unauthorized' });
    req.user = { role: req.headers['x-test-role'] };
    next();
  },
}));
const { TeamMember } = require('../dist/models');
const { Student } = require('../dist/models/student.model');
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
    app.use('/events', require('../dist/routes/event.routes').default);
    app.use('/students', require('../dist/routes/student.routes').default);
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    endpoint = `http://127.0.0.1:${server.address().port}/team/avatar`;
  });
  beforeEach(() => {
    config.cloudinary = { cloudName: 'test-cloud', apiKey: 'test-key', apiSecret: 'test-secret' };
    Student.findByIdAndUpdate.mockResolvedValue({ _id: 'student-1', avatar: 'https://res.cloudinary.com/test-cloud/image/upload/photo.png' });
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
  test.each([['', 401], ['student', 403], ['moderator', 403], ['admin', 201]])('event image endpoint requires admin access: %s', async (role, code) => {
    const form = new FormData();
    form.append('image', new Blob(['photo'], { type: 'image/jpeg' }), 'event.jpg');
    const response = await fetch(endpoint.replace('/team/avatar', '/events/image'), { method: 'POST', headers: role ? { 'x-test-role': role } : {}, body: form });
    expect(response.status).toBe(code);
    if (role === 'admin') {
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ folder: 'comes/events' }), expect.any(Function));
    } else {
      expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    }
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

  const uploadProfile = (headers = { 'x-test-student': 'student-1' }, type = 'image/png', bytes = 10, extraFields = false) => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.alloc(bytes)], { type }), 'photo.png');
    if (extraFields) form.append('studentId', 'another-student');
    return fetch(endpoint.replace('/team/avatar', '/students/me/avatar'), { method: 'POST', headers, body: form });
  };
  test.each([{}, { 'x-test-role': 'admin' }])('profile uploads require student authentication: %j', async headers => {
    expect((await uploadProfile(headers)).status).toBe(401);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  test('saves the uploaded profile image on the authenticated student only', async () => {
    const response = await uploadProfile();
    expect(response.status).toBe(200);
    expect((await response.json()).data.student.avatar).toBe('https://res.cloudinary.com/test-cloud/image/upload/photo.png');
    expect(Student.findByIdAndUpdate).toHaveBeenCalledWith('student-1', { $set: { avatar: 'https://res.cloudinary.com/test-cloud/image/upload/photo.png' } }, { new: true, runValidators: true });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ folder: 'comes/profiles', resource_type: 'image' }), expect.any(Function));
  });
  test.each([['image/svg+xml', 10, false], ['image/png', 3 * 1024 * 1024 + 1, false], ['image/png', 10, true]])('rejects invalid profile uploads without changing the profile: %s %s %s', async (type, bytes, extraFields) => {
    expect((await uploadProfile(undefined, type, bytes, extraFields)).status).toBe(400);
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  test('keeps profile metadata unchanged when Cloudinary fails or is not configured', async () => {
    config.cloudinary.apiSecret = '';
    expect((await uploadProfile()).status).toBe(503);
    config.cloudinary.apiSecret = 'test-secret';
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({ end: () => callback({ http_code: 500, message: 'private provider details' }) }));
    const response = await uploadProfile();
    expect(response.status).toBe(502);
    expect((await response.json()).message).not.toContain('private provider');
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });
  test('reports a profile removed during upload instead of returning a saved avatar', async () => {
    Student.findByIdAndUpdate.mockResolvedValueOnce(null);
    expect((await uploadProfile()).status).toBe(404);
  });
});