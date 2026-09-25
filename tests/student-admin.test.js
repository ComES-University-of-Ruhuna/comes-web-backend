jest.mock('../dist/models/user.model', () => ({ User: { findById: jest.fn(), findOne: jest.fn(), create: jest.fn() } }));
jest.mock('../dist/models/student.model', () => ({ Student: { findById: jest.fn(), findByIdAndUpdate: jest.fn() } }));

const jwt = require('jsonwebtoken');
const config = require('../dist/config').default;
const { User } = require('../dist/models/user.model');
const { Student } = require('../dist/models/student.model');
const { protect, optionalAuth, restrictTo } = require('../dist/middleware/auth.middleware');
const { updateProfile, updateStudentRole } = require('../dist/controllers/student.controller');

const invoke = (handler, request) => new Promise((resolve) => {
  const response = { status: jest.fn().mockReturnThis(), json: (body) => resolve({ body }) };
  handler(request, response, (error) => resolve({ error, request }));
});

describe('student administrator access', () => {
  let request;
  beforeEach(() => {
    jest.clearAllMocks();
    const token = jwt.sign({ id: 'student-1', type: 'student', passwordVersion: 0 }, config.jwt.secret);
    request = { headers: { authorization: `Bearer ${token}` } };
    Student.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'student-1', role: 'admin', adminUser: 'user-1', passwordVersion: 0 }) });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user-1', role: 'admin', isActive: true }) });
  });

  test('authorizes a student admin using a real user ID for content ownership', async () => {
    const { error } = await invoke(protect, request);
    expect(error).toBeUndefined();
    expect(request.user._id).toBe('user-1');
    expect(User.findById).toHaveBeenCalledWith('user-1');
    expect((await invoke(restrictTo('admin'), request)).error).toBeUndefined();
  });

  test('never authorizes a regular student', async () => {
    Student.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ role: 'student', passwordVersion: 0 }) });
    const { error } = await invoke(protect, request);
    expect(error.statusCode).toBe(403);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('does not authorize admin requests with only a leftover student cookie', async () => {
    const { error } = await invoke(protect, { headers: {}, cookies: { studentJwt: request.headers.authorization.split(' ')[1] } });
    expect(error.statusCode).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('rejects a revoked student session', async () => {
    Student.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ role: 'admin', adminUser: 'user-1', passwordVersion: 1 }) });
    expect((await invoke(protect, request)).error.statusCode).toBe(401);
  });

  test('rejects a disabled linked administrator', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ role: 'admin', isActive: false }) });
    expect((await invoke(protect, request)).error.statusCode).toBe(403);
  });

  test('ownership records cannot bypass student authorization using user tokens', async () => {
    const token = jwt.sign({ id: 'user-1', type: 'user', passwordVersion: 0 }, config.jwt.secret);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ role: 'admin', isActive: true, studentAccount: 'student-1' }) });
    expect((await invoke(protect, { headers: { authorization: `Bearer ${token}` } })).error.statusCode).toBe(401);
  });

  test('recognizes student admins on optional-auth quiz reads', async () => {
    await invoke(optionalAuth, request);
    expect(request.user.role).toBe('admin');
  });

  test('profile updates cannot change permissions or inject MongoDB operators', async () => {
    Student.findByIdAndUpdate.mockResolvedValue({ name: 'Updated' });
    await invoke(updateProfile, { student: { _id: 'student-1' }, body: {
      name: 'Updated', role: 'admin', adminUser: 'user-1', passwordVersion: 0,
      $set: { role: 'admin' }, password: 'unsafe', isEmailVerified: true,
    } });
    expect(Student.findByIdAndUpdate).toHaveBeenCalledWith('student-1', { $set: { name: 'Updated' } }, { new: true, runValidators: true });
  });

  test('granting access provisions a separate ownership record without reusing email-based privileges', async () => {
    Student.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'student-1', name: 'Student' }) });
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    User.create.mockResolvedValue({ _id: 'user-1', role: 'admin', isActive: true });
    Student.findByIdAndUpdate.mockResolvedValue({ _id: 'student-1', role: 'admin' });
    const { body } = await invoke(updateStudentRole, { params: { id: 'student-1' }, body: { role: 'admin' }, user: { _id: 'granting-admin' } });
    expect(body.data.student.role).toBe('admin');
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'student-student-1@accounts.comes.invalid', role: 'admin' }));
    expect(Student.findByIdAndUpdate).toHaveBeenCalledWith('student-1', { $set: { role: 'admin', adminUser: 'user-1' } }, { new: true, runValidators: true });
  });

  test('removing admin access preserves the student account and ownership history', async () => {
    Student.findByIdAndUpdate.mockResolvedValue({ _id: 'student-1', role: 'student' });
    const { body } = await invoke(updateStudentRole, { params: { id: 'student-1' }, body: { role: 'student' }, user: { _id: 'granting-admin' } });
    expect(body.data.student.role).toBe('student');
    expect(User.create).not.toHaveBeenCalled();
    expect(Student.findByIdAndUpdate).toHaveBeenCalledWith('student-1', { $set: { role: 'student', adminUser: 'user-1' } }, { new: true, runValidators: true });
  });

  test('prevents self-demotion', async () => {
    const { error } = await invoke(updateStudentRole, { params: { id: 'student-1' }, body: { role: 'student' }, user: { _id: 'user-1' } });
    expect(error.statusCode).toBe(403);
    expect(Student.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});