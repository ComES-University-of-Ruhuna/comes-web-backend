import { Request } from 'express';
import { Event, Student } from '../models';
import {
  asyncHandler,
  AppError,
  AuthorizationError,
  NotFoundError,
} from '../utils';

const memberFields = 'name registrationNo username avatar';
const committeePopulation = {
  path: 'organizingCommittee.member',
  select: memberFields,
  transform: (document: unknown, id: unknown) =>
    document ?? { _id: id, name: 'Deleted member', registrationNo: '' },
};
const detailFields = [
  'title',
  'description',
  'shortDescription',
  'date',
  'endDate',
  'location',
  'type',
  'image',
  'maxParticipants',
  'status',
];

const requireFields = (body: Record<string, unknown>, allowed: string[]) => {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key))
  ) {
    throw new AppError('Unsupported fields in request', 400);
  }
};

const accessFilter = (req: Request): Record<string, unknown> => {
  if (req.user?.role === 'admin') return { _id: req.params.id };
  if (!req.student) throw new AuthorizationError();
  return {
    _id: req.params.id,
    organizingCommittee: {
      $elemMatch: { member: req.student._id, isChair: true },
    },
  };
};

export const searchCommitteeMembers = asyncHandler(async (req, res) => {
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search.length < 2 || search.length > 100) {
    res.json({ success: true, data: { members: [] } });
    return;
  }
  const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const members = await Student.find({
    $or: ['name', 'registrationNo', 'username'].map((field) => ({
      [field]: { $regex: literal, $options: 'i' },
    })),
  })
    .select(memberFields)
    .sort({ name: 1 })
    .limit(20);
  res.json({ success: true, data: { members } });
});

export const getOrganizedEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({
    organizingCommittee: {
      $elemMatch: { member: req.student!._id, isChair: true },
    },
  })
    .select('title date location type status')
    .sort({ date: -1 });
  res.json({ success: true, data: { events } });
});

export const getPublicEventCommittee = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id })
    .select('organizingCommittee')
    .populate<{ organizingCommittee: { member: { name: string } | null; role: string; team: string }[] }>({
      path: 'organizingCommittee.member',
      select: 'name -_id',
    });
  if (!event) throw new NotFoundError('Event');
  const members = event.organizingCommittee.flatMap((entry) => entry.member
    ? [{ name: entry.member.name, role: entry.role, team: entry.team }]
    : []);
  res.json({ success: true, data: { members } });
});

export const getEventCommittee = asyncHandler(async (req, res) => {
  const event = await Event.findOne(accessFilter(req))
    .select('+organizingCommittee')
    .populate(committeePopulation);
  if (!event) throw new NotFoundError('Managed event');
  res.json({ success: true, data: { event } });
});

export const updateOrganizedEvent = asyncHandler(async (req, res) => {
  requireFields(req.body, detailFields);
  const event = await Event.findOneAndUpdate(
    accessFilter(req),
    { $set: req.body },
    { new: true, runValidators: true }
  )
    .select('+organizingCommittee')
    .populate(committeePopulation);
  if (!event) throw new NotFoundError('Managed event');
  res.json({ success: true, data: { event } });
});

export const saveCommitteeMember = asyncHandler(async (req, res) => {
  requireFields(req.body, ['role', 'team', 'isChair']);
  if (!(await Student.exists({ _id: req.params.memberId })))
    throw new NotFoundError('Student');
  const fields = {
    role: req.body.role,
    team: req.body.team,
    isChair: req.body.isChair,
  };
  let event = await Event.findOneAndUpdate(
    { _id: req.params.id, 'organizingCommittee.member': req.params.memberId },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          `organizingCommittee.$.${key}`,
          value,
        ])
      ),
    },
    { new: true, runValidators: true }
  )
    .select('+organizingCommittee')
    .populate(committeePopulation);
  if (!event) {
    event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        'organizingCommittee.member': { $ne: req.params.memberId },
      },
      {
        $push: {
          organizingCommittee: {
            member: req.params.memberId,
            ...fields,
            contributions: '',
          },
        },
      },
      { new: true, runValidators: true }
    )
      .select('+organizingCommittee')
      .populate(committeePopulation);
  }
  if (!event)
    throw new AppError(
      'Event unavailable or committee changed. Refresh and try again.',
      409
    );
  res.json({ success: true, data: { event } });
});

export const removeCommitteeMember = asyncHandler(async (req, res) => {
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, 'organizingCommittee.member': req.params.memberId },
    { $pull: { organizingCommittee: { member: req.params.memberId } } },
    { new: true }
  )
    .select('+organizingCommittee')
    .populate(committeePopulation);
  if (!event) throw new NotFoundError('Committee member');
  res.json({ success: true, data: { event } });
});

export const updateMemberContributions = asyncHandler(async (req, res) => {
  requireFields(req.body, ['contributions']);
  const event = await Event.findOneAndUpdate(
    { ...accessFilter(req), 'organizingCommittee.member': req.params.memberId },
    {
      $set: {
        'organizingCommittee.$[entry].contributions': req.body.contributions,
      },
    },
    {
      new: true,
      runValidators: true,
      arrayFilters: [{ 'entry.member': req.params.memberId }],
    }
  )
    .select('+organizingCommittee')
    .populate(committeePopulation);
  if (!event) throw new NotFoundError('Managed committee member');
  res.json({ success: true, data: { event } });
});
