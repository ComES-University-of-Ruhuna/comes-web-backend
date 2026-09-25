jest.mock('../dist/models', () => ({ Contact: { create: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() } }));
jest.mock('../dist/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(false), emailTemplates: { contactConfirmation: () => ({ subject: 'Received', html: 'Received', text: 'Received' }) } }));
jest.mock('../dist/middleware/auth.middleware', () => ({
  ...jest.requireActual('../dist/middleware/auth.middleware'),
  protect: (req, res, next) => {
    if (!req.headers['x-test-role']) return res.status(401).json({ success: false });
    req.user = { _id: 'admin-1', role: req.headers['x-test-role'] };
    next();
  },
}));
const express = require('express');
const { Contact } = require('../dist/models');
const { sendEmail } = require('../dist/utils/email');
const { getAllContacts } = require('../dist/controllers/contact.controller');
const id = '507f1f77bcf86cd799439011';
const submission = { name: 'Contact Visitor', email: 'visitor@example.com', subject: 'Membership', message: 'Please send the membership application details.' };
let server;
let endpoint;
let saved;
let query;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/contact', require('../dist/routes/contact.routes').default);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  endpoint = `http://127.0.0.1:${server.address().port}/contact`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  jest.clearAllMocks();
  saved = null;
  Contact.create.mockImplementation(async data => {
    saved = { ...data, _id: id, status: 'new', createdAt: '2026-09-25', save: jest.fn().mockResolvedValue(undefined) };
    return saved;
  });
  query = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), sort: jest.fn(async () => saved ? [saved] : []) };
  Contact.find.mockReturnValue(query);
  Contact.countDocuments.mockImplementation(async () => saved ? 1 : 0);
  Contact.findById.mockImplementation(async () => saved);
  Contact.findByIdAndUpdate.mockImplementation(async (contactId, changes) => { if (!saved) return null; Object.assign(saved, changes); return saved; });
  Contact.findByIdAndDelete.mockImplementation(async () => { const previous = saved; saved = null; return previous; });
});
const request = (path = '', method = 'GET', body, role = 'admin') => fetch(`${endpoint}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test('a public submission is persisted and listed for admins even without email delivery', async () => {
  const response = await request('', 'POST', { ...submission, status: 'archived' }, '');
  expect(response.status).toBe(201);
  expect((await response.json()).data.id).toBe(id);
  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(Contact.create).toHaveBeenCalledWith(expect.objectContaining(submission));
  expect(Contact.create.mock.calls[0][0]).not.toHaveProperty('status');
  const inbox = await request();
  expect(inbox.status).toBe(200);
  expect((await inbox.json()).data).toMatchObject({ contacts: [{ ...submission, _id: id, status: 'new' }], pagination: { total: 1, pages: 1 } });
});

test.each([['', 'GET'], ['', 'POST'], ['student', 'GET'], ['student', 'PATCH'], ['moderator', 'DELETE']])('protects private contact operations for %s using %s', async (role, method) => {
  const path = method === 'POST' ? `/${id}/reply` : method === 'GET' ? '' : `/${id}`;
  const response = await request(path, method, method === 'POST' || method === 'PATCH' ? { message: 'Private response', status: 'archived' } : undefined, role);
  expect(response.status).toBe(role ? 403 : 401);
  expect(Contact.find).not.toHaveBeenCalled();
  expect(Contact.findByIdAndUpdate).not.toHaveBeenCalled();
  expect(Contact.findByIdAndDelete).not.toHaveBeenCalled();
});

test('opening marks a new message read, archive persists, and deletion removes it', async () => {
  await request('', 'POST', submission, '');
  expect((await (await request(`/${id}`)).json()).data.contact.status).toBe('read');
  expect(saved.save).toHaveBeenCalledTimes(1);
  const archived = await request(`/${id}`, 'PATCH', { status: 'archived', email: 'other@example.com' });
  expect((await archived.json()).data.contact.status).toBe('archived');
  expect(Contact.findByIdAndUpdate).toHaveBeenCalledWith(id, { status: 'archived' }, { new: true, runValidators: true });
  expect((await request(`/${id}`, 'DELETE')).status).toBe(200);
  expect((await (await request()).json()).data.contacts).toEqual([]);
});

test('missing and invalid contacts return errors instead of successful updates', async () => {
  expect((await request(`/${id}`)).status).toBe(404);
  expect((await request(`/${id}`, 'PATCH', { status: 'read' })).status).toBe(404);
  expect((await request(`/${id}`, 'DELETE')).status).toBe(404);
  expect((await request('/invalid-id')).status).toBe(400);
});

test('search is literal, pagination is bounded, and ordering is stable', async () => {
  const result = await new Promise(resolve => {
    const response = { status: jest.fn().mockReturnThis(), set: jest.fn(), json: body => resolve(body) };
    getAllContacts({ query: { search: '[club] (new)+', status: 'new', page: '-2', limit: '200' } }, response, resolve);
  });
  expect(result.success).toBe(true);
  const filter = Contact.find.mock.calls[0][0];
  expect(filter.status).toBe('new');
  expect(filter.$or[0].name.$regex).toBe('\\[club\\] \\(new\\)\\+');
  expect(Contact.countDocuments).toHaveBeenCalledWith(filter);
  expect(query.skip).toHaveBeenCalledWith(0);
  expect(query.limit).toHaveBeenCalledWith(100);
  expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
});