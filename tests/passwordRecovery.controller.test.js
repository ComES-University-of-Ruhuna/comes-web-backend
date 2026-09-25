jest.mock('../dist/models/user.model', () => ({ User: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(), findById: jest.fn() } }));
jest.mock('../dist/models/student.model', () => ({ Student: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(), findById: jest.fn() } }));
jest.mock('../dist/utils/email', () => ({
  ...jest.requireActual('../dist/utils/email'), sendEmail: jest.fn(),
}));

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../dist/config').default;
const { protect, protectStudent } = require('../dist/middleware/auth.middleware');
const { refreshToken } = require('../dist/controllers/auth.controller');
const { refreshStudentToken } = require('../dist/controllers/student.controller');
const { User } = require('../dist/models/user.model');
const { Student } = require('../dist/models/student.model');
const { sendEmail } = require('../dist/utils/email');
const { userPasswordRecovery, studentPasswordRecovery } = require('../dist/controllers/passwordRecovery.controller');

function invoke(handler, request) {
  return new Promise((resolve) => {
    const response = { status: jest.fn().mockReturnThis(), cookie: jest.fn(), json: (body) => resolve({ body, response }) };
    handler(request, response, (error) => resolve({ error }));
  });
}

describe.each([['user', User, userPasswordRecovery], ['student', Student, studentPasswordRecovery]])('%s password recovery', (accountType, Account, handlers) => {
  let account;
  beforeEach(() => {
    jest.clearAllMocks();
    account = { _id: 'account-1', name: 'Student', email: 'member@example.com', password: 'old-hash', get: jest.fn() };
    Account.findOne.mockResolvedValue(account);
    Account.findOneAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue(account) });
    Account.updateOne.mockResolvedValue({ modifiedCount: 1 });
    sendEmail.mockResolvedValue(true);
  });

  test('emails a confirmation link and leaves the current password unchanged', async () => {
    const { body } = await invoke(handlers.forgotPassword, { body: { email: account.email } });
    const message = sendEmail.mock.calls[0][0];
    const token = message.text.match(/reset-password\/([a-f0-9]{64})/)[1];
    expect(message.text).toContain(`account=${accountType}`);
    expect(Account.updateOne.mock.calls[0][1].$set.passwordResetToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(Account.updateOne.mock.calls[0][1].$set.password).toBeUndefined();
    expect(body).not.toHaveProperty('data');
  });

  test('returns the same response for an unknown address', async () => {
    const known = await invoke(handlers.forgotPassword, { body: { email: account.email } });
    Account.findOne.mockResolvedValue(null);
    const unknown = await invoke(handlers.forgotPassword, { body: { email: 'unknown@example.com' } });
    expect(known.body).toEqual(unknown.body);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('stores only a hash and sends the generated password only by email', async () => {
    const { body } = await invoke(handlers.resetPassword, { params: { token: 'a'.repeat(64) } });
    const password = sendEmail.mock.calls[0][0].text.match(/Your new password: (\S+)/)[1];
    const hash = Account.updateOne.mock.calls[0][1].$set.password;
    expect(password.length).toBeGreaterThanOrEqual(32);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(password);
    expect(body.success).toBe(true);
    expect(Account.updateOne.mock.calls[0][1].$inc).toEqual({ passwordVersion: 1 });
    expect(Account.findOneAndUpdate.mock.calls[0][1].$unset).toEqual({ passwordResetToken: 1, passwordResetExpires: 1 });
  });

  test('restores the previous password when email delivery fails', async () => {
    sendEmail.mockResolvedValue(false);
    const { error } = await invoke(handlers.resetPassword, { params: { token: 'a'.repeat(64) } });
    expect(error.statusCode).toBe(503);
    expect(Account.updateOne.mock.calls[1][1].$set.password).toBe('old-hash');
    expect(Account.updateOne.mock.calls[1][0].password).toBe(Account.updateOne.mock.calls[0][1].$set.password);
  });

  test('also restores the password when the mail transport throws', async () => {
    sendEmail.mockRejectedValue(new Error('SMTP failure'));
    const { error } = await invoke(handlers.resetPassword, { params: { token: 'a'.repeat(64) } });
    expect(error.statusCode).toBe(503);
    expect(Account.updateOne.mock.calls[1][1].$set.password).toBe('old-hash');
  });

  test('does not reveal account existence when the confirmation email fails', async () => {
    sendEmail.mockResolvedValue(false);
    const known = await invoke(handlers.forgotPassword, { body: { email: account.email } });
    Account.findOne.mockResolvedValue(null);
    const unknown = await invoke(handlers.forgotPassword, { body: { email: 'unknown@example.com' } });
    expect(known.body).toEqual(unknown.body);
    expect(Account.updateOne.mock.calls[1][1].$unset).toEqual({ passwordResetToken: 1, passwordResetExpires: 1 });
  });

  test('does not email another link during the account cooldown', async () => {
    Account.updateOne.mockResolvedValue({ modifiedCount: 0 });
    const { body } = await invoke(handlers.forgotPassword, { body: { email: account.email } });
    expect(body.success).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('rejects expired or already consumed tokens without sending a password', async () => {
    Account.findOneAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const { error } = await invoke(handlers.resetPassword, { params: { token: 'a'.repeat(64) } });
    expect(error.statusCode).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe.each([['user', User, protect, refreshToken], ['student', Student, protectStudent, refreshStudentToken]])('%s session revocation', (type, Account, protectHandler, refreshHandler) => {
  const account = { _id: 'account-1', passwordVersion: 1, isActive: true, changedPasswordAfter: () => false };

  test('rejects an access token issued before the reset', async () => {
    const token = jwt.sign({ id: account._id, type, passwordVersion: 0 }, config.jwt.secret);
    Account.findById.mockReturnValue(type === 'user' ? { select: jest.fn().mockResolvedValue(account) } : Promise.resolve(account));
    const { error } = await invoke(protectHandler, { headers: { authorization: `Bearer ${token}` } });
    expect(error.statusCode).toBe(401);
  });

  test('accepts an access token issued after the reset', async () => {
    const token = jwt.sign({ id: account._id, type, passwordVersion: 1 }, config.jwt.secret);
    const select = jest.fn().mockResolvedValue(account);
    Account.findById.mockReturnValue(type === 'user' ? { select } : Promise.resolve(account));
    const { error } = await invoke(protectHandler, { headers: { authorization: `Bearer ${token}` } });
    expect(error).toBeUndefined();
    if (type === 'user') expect(select).toHaveBeenCalledWith('+passwordChangedAt +isActive +studentAccount');
  });

  test('rejects a refresh token issued before the reset', async () => {
    const token = jwt.sign({ id: account._id, type, passwordVersion: 0 }, config.jwt.refreshSecret);
    Account.findById.mockResolvedValue(account);
    const { error } = await invoke(refreshHandler, { body: { refreshToken: token } });
    expect(error.statusCode).toBe(401);
  });
});

describe('password recovery HTTP validation', () => {
  let server;
  let baseUrl;
  beforeAll(async () => {
    const app = require('../dist/app').default;
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test.each(['auth', 'students'])('%s validates recovery requests without authentication', async (path) => {
    const invalidEmail = await fetch(`${baseUrl}/${path}/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(invalidEmail.status).toBe(400);
    const invalidToken = await fetch(`${baseUrl}/${path}/reset-password/invalid`, { method: 'PATCH' });
    expect(invalidToken.status).toBe(400);
    expect((await invalidToken.json()).code).toBe('VALIDATION_ERROR');
  });
});