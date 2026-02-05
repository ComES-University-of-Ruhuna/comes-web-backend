// ============================================
// ComES Backend - Competition Team Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import { CompetitionTeam } from '../models/competitionTeam.model';
import { Student } from '../models/student.model';
import { asyncHandler, AppError, logger } from '../utils';

/**
 * @desc    Create a new competition team
 * @route   POST /api/v1/competition-teams
 * @access  Private (Student)
 */
export const createTeam = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, memberIds } = req.body;
    const leaderId = req.student?._id;

    // Get leader info
    const leader = await Student.findById(leaderId);
    if (!leader) {
      throw new AppError('Student not found', 404);
    }

    // Check if team name already exists
    const existingTeam = await CompetitionTeam.findOne({ name });
    if (existingTeam) {
      throw new AppError('A team with this name already exists', 400);
    }

    // Get member details
    const members = await Promise.all(
      (memberIds || []).map(async (memberId: string) => {
        const student = await Student.findById(memberId);
        if (!student) return null;
        return {
          studentId: student._id,
          name: student.name,
          email: student.email,
          registrationNo: student.registrationNo,
          status: 'pending',
        };
      })
    );

    // Filter out null members
    const validMembers = members.filter((m) => m !== null);

    const team = await CompetitionTeam.create({
      name,
      leaderId,
      leaderName: leader.name,
      leaderEmail: leader.email,
      members: validMembers,
      status: validMembers.length > 0 ? 'pending' : 'active',
    });

    logger.info(`New competition team created: ${name} by ${leader.email}`);

    res.status(201).json({
      success: true,
      data: { team },
    });
  }
);

/**
 * @desc    Get all teams for current student
 * @route   GET /api/v1/competition-teams/my-teams
 * @access  Private (Student)
 */
export const getMyTeams = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;

    const teams = await CompetitionTeam.find({
      $or: [
        { leaderId: studentId },
        { 'members.studentId': studentId, 'members.status': 'approved' },
      ],
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: { teams },
    });
  }
);

/**
 * @desc    Get team by ID
 * @route   GET /api/v1/competition-teams/:id
 * @access  Private (Student)
 */
export const getTeamById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const team = await CompetitionTeam.findById(req.params.id);

    if (!team) {
      throw new AppError('Team not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { team },
    });
  }
);

/**
 * @desc    Get pending invitations for current student
 * @route   GET /api/v1/competition-teams/invitations
 * @access  Private (Student)
 */
export const getPendingInvitations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;

    const teams = await CompetitionTeam.find({
      'members.studentId': studentId,
      'members.status': 'pending',
    });

    const invitations = teams.map((team) => ({
      _id: team._id,
      teamId: team._id,
      teamName: team.name,
      leaderName: team.leaderName,
      invitedAt: team.createdAt,
      status: 'pending',
    }));

    res.status(200).json({
      success: true,
      data: { invitations },
    });
  }
);

/**
 * @desc    Respond to team invitation
 * @route   POST /api/v1/competition-teams/:id/respond
 * @access  Private (Student)
 */
export const respondToInvitation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { status } = req.body;
    const studentId = req.student?._id;
    const teamId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Invalid status. Must be approved or rejected', 400);
    }

    const team = await CompetitionTeam.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Find member in team
    const memberIndex = team.members.findIndex(
      (m) => m.studentId.toString() === studentId?.toString()
    );

    if (memberIndex === -1) {
      throw new AppError('You are not invited to this team', 400);
    }

    // Update member status
    team.members[memberIndex].status = status;
    if (status === 'approved') {
      team.members[memberIndex].joinedAt = new Date();
    }

    // Check if all members have responded
    const allResponded = team.members.every((m) => m.status !== 'pending');
    const allApproved = team.members.every((m) => m.status === 'approved');

    if (allResponded && allApproved) {
      team.status = 'active';
    }

    await team.save();

    res.status(200).json({
      success: true,
      data: { team },
    });
  }
);

/**
 * @desc    Leave a team
 * @route   POST /api/v1/competition-teams/:id/leave
 * @access  Private (Student)
 */
export const leaveTeam = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;
    const teamId = req.params.id;

    const team = await CompetitionTeam.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Check if leader is trying to leave
    if (team.leaderId.toString() === studentId?.toString()) {
      throw new AppError('Team leader cannot leave. Disband the team instead.', 400);
    }

    // Remove member from team
    team.members = team.members.filter(
      (m) => m.studentId.toString() !== studentId?.toString()
    );

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Successfully left the team',
    });
  }
);

/**
 * @desc    Disband a team (leader only)
 * @route   DELETE /api/v1/competition-teams/:id
 * @access  Private (Student - Leader)
 */
export const disbandTeam = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;
    const teamId = req.params.id;

    const team = await CompetitionTeam.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Check if user is the leader
    if (team.leaderId.toString() !== studentId?.toString()) {
      throw new AppError('Only the team leader can disband the team', 403);
    }

    team.status = 'disbanded';
    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team has been disbanded',
    });
  }
);

/**
 * @desc    Remove member from team (leader only)
 * @route   DELETE /api/v1/competition-teams/:id/members/:memberId
 * @access  Private (Student - Leader)
 */
export const removeMember = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;
    const { id: teamId, memberId } = req.params;

    const team = await CompetitionTeam.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Check if user is the leader
    if (team.leaderId.toString() !== studentId?.toString()) {
      throw new AppError('Only the team leader can remove members', 403);
    }

    // Remove member
    team.members = team.members.filter(
      (m) => m.studentId.toString() !== memberId
    );

    await team.save();

    res.status(200).json({
      success: true,
      data: { team },
    });
  }
);
