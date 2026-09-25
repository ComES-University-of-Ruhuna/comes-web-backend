const mongoose = require('mongoose');
const { errorHandler } = require('../dist/middleware/error.middleware');
const { ValidationError } = require('../dist/utils/errors');

describe('errorHandler', () => {
  const originalEnvironment = process.env.NODE_ENV;
  let response;
  let next;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    jest.restoreAllMocks();
  });

  test('does not expose unexpected error details in production', () => {
    errorHandler(new Error('private database details'), {}, response, next);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Something went wrong. Please try again later.',
      code: 'INTERNAL_ERROR',
    });
  });

  test('preserves application validation errors', () => {
    errorHandler(new ValidationError('Invalid input', { email: 'Required' }), {}, response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid input', errors: { email: 'Required' },
    }));
  });

  test('converts mongoose validation errors', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError('email', new mongoose.Error.ValidatorError({ path: 'email', message: 'Required' }));
    errorHandler(error, {}, response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ errors: { email: 'Required' } }));
  });

  test('forwards errors after headers are sent', () => {
    const error = new Error('stream failed');
    response.headersSent = true;
    errorHandler(error, {}, response, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(response.json).not.toHaveBeenCalled();
  });
});