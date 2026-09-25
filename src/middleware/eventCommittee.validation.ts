import { body, param } from 'express-validator';
import { eventValidations } from './validation.middleware';

export const committeeEventId = [param('id').isMongoId()];
export const committeeMemberId = [
  ...committeeEventId,
  param('memberId').isMongoId(),
];
export const committeeAssignment = [
  ...committeeMemberId,
  body('role').isString().bail().trim().isLength({ min: 1, max: 100 }),
  body('team').isString().bail().trim().isLength({ min: 1, max: 100 }),
  body('isChair').isBoolean({ strict: true }),
];
export const committeeContributions = [
  ...committeeMemberId,
  body('contributions').isString().bail().isLength({ max: 5000 }),
];
export const organizedEventDetails = [
  ...committeeEventId,
  ...eventValidations.update,
  body('endDate').optional().isISO8601(),
  body('location')
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ min: 2, max: 200 }),
  body('type')
    .optional()
    .isIn([
      'workshop',
      'hackathon',
      'seminar',
      'competition',
      'social',
      'other',
    ]),
  body('maxParticipants').optional().isInt({ min: 1 }),
  body('shortDescription').optional().isString().bail().isLength({ max: 300 }),
  body('image').optional().isString().bail().isLength({ max: 2000 }),
];
