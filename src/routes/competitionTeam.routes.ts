// ============================================
// ComES Backend - Competition Team Routes
// ============================================

import { Router } from 'express';
import {
  createTeam,
  getMyTeams,
  getTeamById,
  getPendingInvitations,
  respondToInvitation,
  leaveTeam,
  disbandTeam,
  removeMember,
} from '../controllers/competitionTeam.controller';
import { protectStudent } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// All routes require student authentication
router.use(protectStudent);

// Validation rules
const teamValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Team name must be between 2 and 100 characters'),
  ],
  respond: [
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be approved or rejected'),
  ],
};

// Team routes
router.post('/', validate(teamValidation.create), createTeam);
router.get('/my-teams', getMyTeams);
router.get('/invitations', getPendingInvitations);
router.get('/:id', validate(commonValidations.mongoId('id')), getTeamById);
router.post('/:id/respond', validate([...commonValidations.mongoId('id'), ...teamValidation.respond]), respondToInvitation);
router.post('/:id/leave', validate(commonValidations.mongoId('id')), leaveTeam);
router.delete('/:id', validate(commonValidations.mongoId('id')), disbandTeam);
router.delete('/:id/members/:memberId', validate([...commonValidations.mongoId('id'), ...commonValidations.mongoId('memberId')]), removeMember);

export default router;
