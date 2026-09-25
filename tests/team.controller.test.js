jest.mock('../dist/models', () => ({ TeamMember: { find: jest.fn(), findOne: jest.fn(), findByIdAndUpdate: jest.fn() } }));
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