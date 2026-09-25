jest.mock('../dist/models', () => ({ BlogPost: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), countDocuments: jest.fn() }, Project: { find: jest.fn(), countDocuments: jest.fn() } }));
const { BlogPost, Project } = require('../dist/models');
const { getAllProjects, getFeaturedProjects } = require('../dist/controllers/project.controller');
const { getAllPosts, getPost, getPostBySlug, updatePost } = require('../dist/controllers/blog.controller');

const invoke = (handler, request) => new Promise((resolve) => {
  const response = { status: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), json: (body) => resolve({ body }) };
  handler(request, response, (error) => resolve({ error }));
});

let query;
beforeEach(() => {
  jest.clearAllMocks();
  query = { populate: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValue([]) };
  BlogPost.find.mockReturnValue(query);
  BlogPost.countDocuments.mockResolvedValue(0);
  Project.find.mockReturnValue(query);
  Project.countDocuments.mockResolvedValue(0);
});

test.each([undefined, { role: 'user' }])('public visitors cannot request drafts', async (user) => {
  await invoke(getAllPosts, { query: { includeDrafts: 'true', status: 'draft' }, user });
  expect(BlogPost.find).toHaveBeenCalledWith({ status: 'published' });
  expect(query.select).toHaveBeenCalledWith('-content');
});

test('admin editors can list drafts with their saved content', async () => {
  await invoke(getAllPosts, { query: { includeDrafts: 'true' }, user: { role: 'admin' } });
  expect(BlogPost.find).toHaveBeenCalledWith({});
  expect(query.select).toHaveBeenCalledWith('');
});

test('public ID and slug lookups exclude unpublished articles', async () => {
  BlogPost.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
  expect((await invoke(getPost, { params: { id: 'post-1' } })).error.statusCode).toBe(404);
  expect(BlogPost.findOne).toHaveBeenCalledWith({ _id: 'post-1', status: 'published' });
  expect((await invoke(getPostBySlug, { params: { slug: 'draft-post' } })).error.statusCode).toBe(404);
  expect(BlogPost.findOne).toHaveBeenCalledWith({ slug: 'draft-post', status: 'published' });
});

test('publishing edits invokes save middleware without replacing ownership', async () => {
  const post = { set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
  BlogPost.findById.mockResolvedValue(post);
  const { body } = await invoke(updatePost, { params: { id: 'post-1' }, body: { title: 'Published article', content: 'Updated content', status: 'published', author: 'other-user', views: 999 } });
  expect(post.set).toHaveBeenCalledWith({ title: 'Published article', content: 'Updated content', status: 'published' });
  expect(post.save).toHaveBeenCalledTimes(1);
  expect(body.success).toBe(true);
});

test('archived projects cannot be requested by public visitors', async () => {
  await invoke(getAllProjects, { query: { includeArchived: 'true', status: 'archived' } });
  expect(Project.find).toHaveBeenCalledWith({ status: { $eq: 'archived', $ne: 'archived' } });
});

test('admins can retrieve archived projects for editing', async () => {
  await invoke(getAllProjects, { query: { includeArchived: 'true' }, user: { role: 'admin' } });
  expect(Project.find).toHaveBeenCalledWith({});
});

test('featured projects exclude archived entries', async () => {
  await invoke(getFeaturedProjects, { query: {} });
  expect(Project.find).toHaveBeenCalledWith({ isFeatured: true, status: { $ne: 'archived' } });
});

test.each([[getAllPosts, BlogPost], [getAllProjects, Project]])('search treats punctuation as literal text', async (handler, model) => {
  const { body } = await invoke(handler, { query: { search: '[React] (new)+' } });
  expect(body.success).toBe(true);
  expect(model.find.mock.calls[0][0].$or[0].title.$regex).toBe('\\[React\\] \\(new\\)\\+');
});

test('named project contributors distinguish an unset list from an intentionally empty list', () => {
  const { Project: ProjectModel } = jest.requireActual('../dist/models/project.model');
  const record = new ProjectModel();
  expect(record.teamMembers).toBeUndefined();
  record.teamMembers = [];
  expect(record.teamMembers).toEqual([]);
});