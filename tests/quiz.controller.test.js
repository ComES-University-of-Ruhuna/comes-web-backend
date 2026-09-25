jest.mock('../dist/models/quiz.model', () => ({ Quiz: { findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn() } }));
jest.mock('../dist/models/quizAttempt.model', () => ({ QuizAttempt: { create: jest.fn() } }));

const { Quiz } = require('../dist/models/quiz.model');
const { QuizAttempt } = require('../dist/models/quizAttempt.model');
const { submitQuizAttempt, getQuizById, getAllQuizzes } = require('../dist/controllers/quiz.controller');
const { quizValidations } = require('../dist/middleware/validation.middleware');
const { validationResult } = require('express-validator');

describe('quiz read access', () => {
  function invoke(handler, request) {
    return new Promise((resolve) => {
      const response = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: (body) => resolve({ body }) };
      handler(request, response, (error) => resolve({ error }));
    });
  }

  test.each([undefined, { role: 'user' }])('hides private quizzes from non-admins', async (user) => {
    const select = jest.fn().mockResolvedValue({ isVisible: false });
    Quiz.findById.mockReturnValue({ select });
    const { error } = await invoke(getQuizById, { params: { id: 'quiz-1' }, user });
    expect(error.statusCode).toBe(404);
    expect(select).toHaveBeenCalledWith('-questions.answers.isCorrect');
  });

  test('allows admins to read private quizzes and answer keys', async () => {
    const quiz = { isVisible: false };
    const select = jest.fn().mockResolvedValue(quiz);
    Quiz.findById.mockReturnValue({ select });
    const { body } = await invoke(getQuizById, { params: { id: 'quiz-1' }, user: { role: 'admin' } });
    expect(body.data.quiz).toEqual(quiz);
    expect(select).toHaveBeenCalledWith('');
  });

  test('ignores includeHidden for public listings', async () => {
    const query = { select: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) };
    Quiz.find.mockReturnValue(query);
    Quiz.countDocuments.mockResolvedValue(0);
    await invoke(getAllQuizzes, { query: { includeHidden: 'true' } });
    expect(Quiz.find).toHaveBeenCalledWith({ isVisible: true });
    expect(query.select).toHaveBeenCalledWith('-questions.answers.isCorrect');
  });
});

describe('submitQuizAttempt', () => {
  const validResponse = { questionId: 'question-1', selectedAnswerIndex: 0, responseTimeSeconds: 5 };

  beforeEach(() => {
    jest.clearAllMocks();
    Quiz.findById.mockResolvedValue({
      _id: 'quiz-1', isVisible: true,
      questions: [{ _id: 'question-1', answers: [{ isCorrect: true }], marks: 10, timeLimitSeconds: 10 }],
    });
    QuizAttempt.create.mockImplementation(async (attempt) => attempt);
  });

  function submit(responses) {
    return new Promise((resolve) => {
      const response = { status: jest.fn().mockReturnThis(), json: (body) => resolve({ body }) };
      submitQuizAttempt({ params: { id: 'quiz-1' }, body: { responses }, student: { name: 'Student', _id: 'student-1' } },
        response, (error) => resolve({ error }));
    });
  }

  test('scores a valid response', async () => {
    const { body } = await submit([validResponse]);
    expect(body.data.attempt.totalMarks).toBe(5);
    expect(body.data.attempt.percentage).toBe(50);
  });

  test('allows an unanswered question', async () => {
    const { body } = await submit([{ ...validResponse, selectedAnswerIndex: -1 }]);
    expect(body.data.attempt.totalMarks).toBe(0);
  });

  test('accepts authenticated submissions without a client participant name', async () => {
    const request = { body: { responses: [{ ...validResponse, questionId: '507f1f77bcf86cd799439011', selectedAnswerIndex: -1 }] } };
    for (const validation of quizValidations.submitAttempt) await validation.run(request);
    expect(validationResult(request).array()).toEqual([]);
  });

  test('persists the unanswered sentinel', () => {
    const { QuizAttempt: AttemptModel } = jest.requireActual('../dist/models/quizAttempt.model');
    const attempt = new AttemptModel({
      quizId: '507f1f77bcf86cd799439011', studentId: '507f1f77bcf86cd799439012',
      participantName: 'Student', totalMarks: 0, maxMarks: 10, percentage: 0,
      responses: [{ ...validResponse, questionId: '507f1f77bcf86cd799439013', selectedAnswerIndex: -1 }],
    });
    expect(attempt.validateSync()).toBeUndefined();
  });

  test.each([
    [validResponse, validResponse],
    [{ ...validResponse, responseTimeSeconds: -1 }],
    [{ ...validResponse, responseTimeSeconds: Infinity }],
    [{ ...validResponse, selectedAnswerIndex: 2 }],
    [{ ...validResponse, selectedAnswerIndex: 0.5 }],
    [null],
  ].map((responses) => [responses]))('rejects invalid responses %j', async (responses) => {
    const { error } = await submit(responses);
    expect(error.statusCode).toBe(400);
    expect(QuizAttempt.create).not.toHaveBeenCalled();
  });
});