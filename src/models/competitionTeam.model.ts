// ============================================
// ComES Backend - Competition Team Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export type TeamStatus = 'pending' | 'active' | 'disbanded';
export type TeamMemberStatus = 'pending' | 'approved' | 'rejected';

export interface ICompetitionTeamMember {
  studentId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  registrationNo: string;
  status: TeamMemberStatus;
  joinedAt?: Date;
}

export interface ICompetitionTeam extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  leaderId: mongoose.Types.ObjectId;
  leaderName: string;
  leaderEmail: string;
  members: ICompetitionTeamMember[];
  status: TeamStatus;
  createdAt: Date;
  updatedAt: Date;
}

const competitionTeamMemberSchema = new Schema<ICompetitionTeamMember>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    registrationNo: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    joinedAt: Date,
  },
  { _id: false }
);

const competitionTeamSchema = new Schema<ICompetitionTeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Team name cannot be more than 100 characters'],
    },
    leaderId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    leaderName: {
      type: String,
      required: true,
    },
    leaderEmail: {
      type: String,
      required: true,
    },
    members: [competitionTeamMemberSchema],
    status: {
      type: String,
      enum: ['pending', 'active', 'disbanded'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
competitionTeamSchema.index({ leaderId: 1 });
competitionTeamSchema.index({ 'members.studentId': 1 });
competitionTeamSchema.index({ status: 1 });

export const CompetitionTeam = mongoose.model<ICompetitionTeam>(
  'CompetitionTeam',
  competitionTeamSchema
);
