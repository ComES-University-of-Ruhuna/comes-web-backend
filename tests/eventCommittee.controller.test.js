jest.mock('../dist/models', () => ({
  Event: { find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn() },
  Student: { exists: jest.fn(), find: jest.fn() },
}));
const { Event, Student } = require('../dist/models');
const handlers = require('../dist/controllers/eventCommittee.controller');
const { validationResult } = require('express-validator');
const {
  committeeAssignment,
  committeeContributions,
} = require('../dist/middleware/eventCommittee.validation');

const invoke = (handler, request) =>
  new Promise((resolve) => {
    handler(request, { json: (body) => resolve({ body }) }, (error) =>
      resolve({ error })
    );
  });
const eventId = '507f1f77bcf86cd799439011';
const memberId = '507f1f77bcf86cd799439012';
const chairId = '507f1f77bcf86cd799439013';
const request = (body = {}) => ({
  params: { id: eventId, memberId },
  student: { _id: chairId },
  body,
});
const query = (record) => ({
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockResolvedValue(record),
});

beforeEach(() => {
  jest.resetAllMocks();
  Event.findOne.mockReturnValue(query({ _id: eventId }));
  Event.findOneAndUpdate.mockReturnValue(query({ _id: eventId }));
  Student.exists.mockResolvedValue({ _id: memberId });
});

test('private committee data is excluded from public event queries', () => {
  const { Event: Model } = jest.requireActual('../dist/models/event.model');
  expect(Model.schema.path('organizingCommittee').options.select).toBe(false);
});

test('registration defaults to platform for existing event workflows', () => {
  const { Event: Model } = jest.requireActual('../dist/models/event.model');
  expect(new Model().registrationMode).toBe('platform');
});

test.each(['event', 'student'])('%s registration refuses custom-link events without enrollment', async (controller) => {
  Event.findById.mockResolvedValue({ status: 'upcoming', registrationMode: 'custom' });
  const { registerForEvent } = require(`../dist/controllers/${controller}.controller`);
  const result = await invoke(registerForEvent, { params: { id: eventId, eventId }, student: { _id: memberId } });
  expect(result.error.statusCode).toBe(400);
  expect(result.error.message).toBe('Use the custom registration link for this event');
});

test.each(['create', 'update'])('event %s validates registration mode and custom links', async (operation) => {
  const { eventValidations } = require('../dist/middleware/validation.middleware');
  const base = { title: 'Workshop', description: 'A community workshop', location: 'Faculty hall', date: '2099-01-01T10:00:00Z', type: 'workshop' };
  for (const [fields, valid] of [
    [{}, true],
    [{ registrationMode: 'platform', registrationUrl: '' }, true],
    [{ registrationMode: 'custom', registrationUrl: 'https://forms.example.com/register' }, true],
    [{ registrationMode: 'custom' }, false],
    [{ registrationMode: 'custom', registrationUrl: 'javascript:alert(1)' }, false],
    [{ registrationMode: 'custom', registrationUrl: 'https://user:password@example.com' }, false],
    [{ registrationMode: 'unknown' }, false],
    [{ registrationUrl: 'https://example.com' }, false],
  ]) {
    const req = { body: { ...base, ...fields } };
    await Promise.all(eventValidations[operation].map((validation) => validation.run(req)));
    expect(validationResult(req).isEmpty()).toBe(valid);
  }
});

test('public committee exposes only names, roles and teams and omits deleted accounts', async () => {
  const chain = query({ organizingCommittee: [
    { member: { name: 'Alex', email: 'private@example.com', registrationNo: 'PRIVATE' }, role: 'Chair', team: 'Operations', isChair: true, contributions: 'Private notes' },
    { member: null, role: 'Member', team: 'Logistics' },
  ] });
  Event.findOne.mockReturnValue(chain);
  const { body } = await invoke(handlers.getPublicEventCommittee, { params: { id: eventId } });
  expect(body.data.members).toEqual([{ name: 'Alex', role: 'Chair', team: 'Operations' }]);
  expect(chain.select).toHaveBeenCalledWith('organizingCommittee');
  expect(chain.populate).toHaveBeenCalledWith({ path: 'organizingCommittee.member', select: 'name -_id' });
});

test('public committee supports an empty roster and a missing event', async () => {
  Event.findOne.mockReturnValue(query({ organizingCommittee: [] }));
  expect((await invoke(handlers.getPublicEventCommittee, request())).body.data.members).toEqual([]);
  Event.findOne.mockReturnValue(query(null));
  expect((await invoke(handlers.getPublicEventCommittee, request())).error.statusCode).toBe(404);
});

test.each(['create', 'update'])('event %s validates images, end times and the three categories', async (operation) => {
  const { eventValidations } = require('../dist/middleware/validation.middleware');
  const base = { title: 'Workshop', description: 'A community workshop', location: 'Faculty hall', date: '2099-01-01T10:00:00Z', type: 'workshop' };
  for (const fields of [ { endDate: '2099-01-01T09:00:00Z' }, { image: 'javascript:alert(1)' }, { type: 'social' } ]) {
    const req = { body: { ...base, ...fields } };
    await Promise.all(eventValidations[operation].map((validation) => validation.run(req)));
    expect(validationResult(req).isEmpty()).toBe(false);
  }
  for (const type of ['competition', 'workshop', 'other']) {
    const req = { body: { ...base, type, image: 'https://example.com/event.jpg', endDate: null } };
    await Promise.all(eventValidations[operation].map((validation) => validation.run(req)));
    expect(validationResult(req).isEmpty()).toBe(true);
  }
});

test.each([['hackathon', 'competition'], ['seminar', 'workshop'], ['social', 'other']])('legacy category %s serializes as %s', (legacy, category) => {
  const { Event: Model } = jest.requireActual('../dist/models/event.model');
  const record = new Model({ type: legacy });
  expect(record.toJSON().type).toBe(category);
});

test('lists only events where this student is explicitly assigned as chair', async () => {
  Event.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([]),
  });
  await invoke(handlers.getOrganizedEvents, request());
  expect(Event.find).toHaveBeenCalledWith({
    organizingCommittee: { $elemMatch: { member: chairId, isChair: true } },
  });
});

test('chair reads require a matching member AND chair flag on the same assignment', async () => {
  await invoke(handlers.getEventCommittee, request());
  expect(Event.findOne).toHaveBeenCalledWith({
    _id: eventId,
    organizingCommittee: { $elemMatch: { member: chairId, isChair: true } },
  });
});

test('admins can inspect any event committee', async () => {
  await invoke(handlers.getEventCommittee, {
    ...request(),
    student: undefined,
    user: { role: 'admin' },
  });
  expect(Event.findOne).toHaveBeenCalledWith({ _id: eventId });
});

test('deleted accounts retain their assignment ID for administrator removal', async () => {
  const chain = query({ _id: eventId });
  Event.findOne.mockReturnValue(chain);
  await invoke(handlers.getEventCommittee, request());
  const population = chain.populate.mock.calls[0][0];
  expect(population.select).toBe('name registrationNo username avatar');
  expect(population.transform(null, memberId)).toEqual({
    _id: memberId,
    name: 'Deleted member',
    registrationNo: '',
  });
});

test('assignment endpoints remain behind both authentication and administrator authorization', () => {
  const { protect } = require('../dist/middleware/auth.middleware');
  const router = require('../dist/routes/event.routes').default;
  for (const path of [
    '/committee-members',
    '/:id/committee',
    '/:id/committee/:memberId',
    '/:id/committee/:memberId/contributions',
  ]) {
    const routes = router.stack.filter((layer) => layer.route?.path === path);
    expect(routes.length).toBeGreaterThan(0);
    for (const { route } of routes) {
      expect(route.stack[0].handle).toBe(protect);
      expect(() =>
        route.stack[1].handle(
          { student: { _id: chairId }, user: { role: 'user' } },
          {},
          jest.fn()
        )
      ).toThrow('permission');
    }
  }
});

test('chair routes use student authentication and do not expose assignment writes', () => {
  const { protectStudent } = require('../dist/middleware/auth.middleware');
  const router = require('../dist/routes/student.routes').default;
  const authIndex = router.stack.findIndex(
    (layer) => layer.handle === protectStudent
  );
  const routes = router.stack.filter(
    (layer, index) =>
      index > authIndex && layer.route?.path.startsWith('/organized-events')
  );
  expect(authIndex).toBeGreaterThan(-1);
  expect(routes).toHaveLength(4);
  expect(
    routes.some(
      ({ route }) =>
        route.methods.put || route.methods.delete || route.methods.post
    )
  ).toBe(false);
});

test.each([
  'organizingCommittee',
  'isFeatured',
  'createdBy',
  'registeredCount',
  '$set',
])('chairs cannot write privileged field %s', async (field) => {
  const result = await invoke(
    handlers.updateOrganizedEvent,
    request({ [field]: {} })
  );
  expect(result.error.statusCode).toBe(400);
  expect(Event.findOneAndUpdate).not.toHaveBeenCalled();
});

test('event detail updates atomically require current chair access', async () => {
  const { body } = await invoke(
    handlers.updateOrganizedEvent,
    request({ title: 'Updated event', description: 'Updated event details' })
  );
  expect(body.success).toBe(true);
  expect(Event.findOneAndUpdate).toHaveBeenCalledWith(
    {
      _id: eventId,
      organizingCommittee: { $elemMatch: { member: chairId, isChair: true } },
    },
    { $set: { title: 'Updated event', description: 'Updated event details' } },
    { new: true, runValidators: true }
  );
});

test.each([
  'getEventCommittee',
  'updateOrganizedEvent',
  'updateMemberContributions',
])('denies an unassigned or revoked chair in %s', async (handler) => {
  Event.findOne.mockReturnValue(query(null));
  Event.findOneAndUpdate.mockReturnValue(query(null));
  const result = await invoke(
    handlers[handler],
    request(
      handler === 'updateMemberContributions' ? { contributions: 'Notes' } : {}
    )
  );
  expect(result.error.statusCode).toBe(404);
});

test('contributions only update the selected event member and recheck chair access', async () => {
  await invoke(
    handlers.updateMemberContributions,
    request({ contributions: 'Led workshop logistics' })
  );
  expect(Event.findOneAndUpdate).toHaveBeenCalledWith(
    {
      _id: eventId,
      organizingCommittee: { $elemMatch: { member: chairId, isChair: true } },
      'organizingCommittee.member': memberId,
    },
    {
      $set: {
        'organizingCommittee.$[entry].contributions': 'Led workshop logistics',
      },
    },
    {
      new: true,
      runValidators: true,
      arrayFilters: [{ 'entry.member': memberId }],
    }
  );
});

test('contribution writes cannot change roles or promote chairs', async () => {
  const { error } = await invoke(
    handlers.updateMemberContributions,
    request({ contributions: '', isChair: true })
  );
  expect(error.statusCode).toBe(400);
  expect(Event.findOneAndUpdate).not.toHaveBeenCalled();
});

test('rejects assigning nonexistent students', async () => {
  Student.exists.mockResolvedValue(null);
  expect(
    (
      await invoke(
        handlers.saveCommitteeMember,
        request({ role: 'Chair', team: 'Operations', isChair: true })
      )
    ).error.statusCode
  ).toBe(404);
  expect(Event.findOneAndUpdate).not.toHaveBeenCalled();
});

test('updating an assignment preserves contributions', async () => {
  await invoke(
    handlers.saveCommitteeMember,
    request({ role: 'Coordinator', team: 'Logistics', isChair: false })
  );
  expect(Event.findOneAndUpdate.mock.calls[0][1]).toEqual({
    $set: {
      'organizingCommittee.$.role': 'Coordinator',
      'organizingCommittee.$.team': 'Logistics',
      'organizingCommittee.$.isChair': false,
    },
  });
});

test('new assignments cannot duplicate an existing member', async () => {
  Event.findOneAndUpdate.mockReturnValueOnce(query(null));
  await invoke(
    handlers.saveCommitteeMember,
    request({ role: 'Chair', team: 'Operations', isChair: true })
  );
  expect(Event.findOneAndUpdate.mock.calls[1][0]).toEqual({
    _id: eventId,
    'organizingCommittee.member': { $ne: memberId },
  });
});

test('removal only pulls the selected event member', async () => {
  await invoke(handlers.removeCommitteeMember, request());
  expect(Event.findOneAndUpdate.mock.calls[0][1]).toEqual({
    $pull: { organizingCommittee: { member: memberId } },
  });
});

test('member search escapes regex and only returns limited profile fields', async () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  };
  Student.find.mockReturnValue(chain);
  await invoke(handlers.searchCommitteeMembers, {
    query: { search: '[Alex]+' },
  });
  expect(Student.find.mock.calls[0][0].$or[0].name.$regex).toBe(
    '\\[Alex\\]\\+'
  );
  expect(chain.select).toHaveBeenCalledWith(
    'name registrationNo username avatar'
  );
  expect(chain.limit).toHaveBeenCalledWith(20);
});

test.each([
  [committeeAssignment, { role: '', team: 'Team', isChair: false }],
  [committeeAssignment, { role: 'Chair', team: 'Team', isChair: 'true' }],
  [committeeContributions, { contributions: 'x'.repeat(5001) }],
])('validates assignment and contribution input', async (rules, body) => {
  const req = request(body);
  for (const rule of rules) await rule.run(req);
  expect(validationResult(req).isEmpty()).toBe(false);
});
