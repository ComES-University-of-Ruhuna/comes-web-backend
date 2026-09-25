import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import { User, IUser } from '../models/user.model';
import { Student, IStudent } from '../models/student.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { sendEmail, emailTemplates } from '../utils/email';
import config from '../config';

const recoveryMessage = 'If an account with that email exists, a password reset link has been sent.';

const createPasswordRecovery = <AccountType extends IUser | IStudent>(Account: Model<AccountType>, accountType: 'user' | 'student') => {

  const forgotPassword = asyncHandler(async (req, res) => {
    const account = await Account.findOne({ email: req.body.email });
    if (account) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = Date.now();
      const result = await Account.updateOne({
        _id: account._id,
        $or: [
          { passwordResetExpires: { $exists: false } },
          { passwordResetExpires: { $lte: new Date(now + 9 * 60 * 1000) } },
        ],
      }, {
        $set: { passwordResetToken: tokenHash, passwordResetExpires: new Date(now + 10 * 60 * 1000) },
      });

      if (result.modifiedCount === 1) {
        const resetUrl = `${config.frontendUrl}/reset-password/${token}?account=${accountType}`;
        const template = emailTemplates.passwordReset(account.name, resetUrl);
        const sent = await sendEmail({ to: account.email, ...template, sensitive: true }).catch(() => false);
        if (!sent) {
          await Account.updateOne({ _id: account._id, passwordResetToken: tokenHash }, {
            $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
          });
        }
      }
    }

    res.status(200).json({ success: true, message: recoveryMessage });
  });

  const resetPassword = asyncHandler(async (req, res) => {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const account = await Account.findOneAndUpdate({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }, {
      $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
    }, { new: false }).select('+password +passwordChangedAt');

    if (!account) {
      throw new AppError('This reset link is invalid or has expired. Request a new link.', 400);
    }

    const password = `Aa1!${crypto.randomBytes(24).toString('base64url')}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const previousPasswordChangedAt = account.get('passwordChangedAt') as Date | undefined;
    const updated = await Account.updateOne({ _id: account._id, password: account.password }, {
      $set: { password: passwordHash, passwordChangedAt: new Date() },
      $inc: { passwordVersion: 1 },
      $unset: { refreshToken: 1 },
    });

    if (updated.modifiedCount !== 1) {
      throw new AppError('The account changed during this reset. Request a new link.', 409);
    }

    const template = emailTemplates.generatedPassword(account.name, password);
    const sent = await sendEmail({ to: account.email, ...template, sensitive: true }).catch(() => false);
    if (!sent) {
      await Account.updateOne({ _id: account._id, password: passwordHash }, {
        $set: {
          password: account.password,
          ...(previousPasswordChangedAt ? { passwordChangedAt: previousPasswordChangedAt } : {}),
        },
        ...(!previousPasswordChangedAt ? { $unset: { passwordChangedAt: 1 } } : {}),
      });
      throw new AppError('The new password could not be emailed. Request another reset link and try again.', 503);
    }

    res.status(200).json({ success: true, message: 'Your new password has been emailed to you. Change it after signing in.' });
  });

  return { forgotPassword, resetPassword };
};

export const userPasswordRecovery = createPasswordRecovery(User, 'user');
export const studentPasswordRecovery = createPasswordRecovery(Student, 'student');