# ComES Backend API

A secure, production-ready Node.js/Express backend for the ComES website.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - Password hashing with bcryptjs
  - Role-based access control (admin, user)
  - Password reset via email
  - Email verification

- **Security**
  - Helmet.js for HTTP security headers
  - CORS configuration
  - Rate limiting (100 requests/15 minutes)
  - MongoDB injection prevention
  - XSS protection
  - HTTP Parameter Pollution prevention
  - Input validation with express-validator

- **API Features**
  - RESTful API design
  - Centralized error handling
  - Request logging
  - File upload support
  - Email notifications

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts  # MongoDB connection
│   │   └── index.ts     # Centralized config
│   ├── controllers/     # Route handlers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── event.controller.ts
│   │   ├── project.controller.ts
│   │   ├── blog.controller.ts
│   │   ├── contact.controller.ts
│   │   ├── newsletter.controller.ts
│   │   └── team.controller.ts
│   ├── middleware/      # Custom middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── models/          # Mongoose models
│   │   ├── user.model.ts
│   │   ├── event.model.ts
│   │   ├── project.model.ts
│   │   ├── blog.model.ts
│   │   ├── contact.model.ts
│   │   ├── newsletter.model.ts
│   │   └── team.model.ts
│   ├── routes/          # API routes
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── event.routes.ts
│   │   ├── project.routes.ts
│   │   ├── blog.routes.ts
│   │   ├── contact.routes.ts
│   │   ├── newsletter.routes.ts
│   │   └── team.routes.ts
│   ├── utils/           # Utility functions
│   │   ├── asyncHandler.ts
│   │   ├── email.ts
│   │   ├── errors.ts
│   │   └── logger.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── uploads/             # File uploads directory
├── .env                 # Environment variables
├── .env.example         # Environment template
├── package.json
└── tsconfig.json
```

## 🛠 Setup

### Prerequisites

- Node.js 20+ (required by Nodemailer)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the MongoDB connection string
   - Set secure JWT secrets
   - Configure email settings (if using)

4. Start the development server:
   ```bash
   npm run dev
   ```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/comes_db` |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `30d` |
| `FRONTEND_URL` | Frontend URL for CORS and password recovery links | `http://localhost:5173` |
| `SMTP_HOST` | SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password or provider app password | - |
| `EMAIL_FROM` | Default from address | - |

### Executive Committee Details

Administrators, including authorized student admins, manage committee records at **Admin > Committee & Team** (`/admin/team`). Select the Executive Committee department to edit names, positions, photos, biographies, contact details, social links, display order, term dates, and visibility. Inactive records remain available in the admin list for reactivation but are excluded from public lists and public detail requests.

The public `/team` page reads saved, active API records rather than hard-coded profiles. Before deploying this frontend change, publish the desired committee records. The Add Member editor offers the previous executive roster as optional starting entries; select a member, supply the batch and correct term dates, then save. Other team and advisor records can be added directly. No existing profiles are automatically imported and no database records are changed by loading the editor.

`GET /api/v1/team?includeInactive=true` includes inactive records only when authenticated as an admin. All create, update, delete, and reorder operations remain admin-only.

### Blog and Project Publishing

Admins and authorized student admins manage saved content at `/admin/blog` and `/admin/projects`. Blog posts start as drafts; select **Published** to make an article visible at `/blog` and `/blog/:slug`. Article bodies support Markdown. Draft and archived articles are not publicly readable. Updating an article recalculates its slug and reading time and sets its first publication date.

Saved projects with **In Progress** or **Completed** status appear at `/projects`; **Archived** hides a project from public lists and details. Enable **Featured** to include a published article or a non-archived project in featured sections. Project contributor names use `teamMembers`; existing linked User records in `team` remain supported.

`GET /api/v1/blog?includeDrafts=true` returns all statuses and article content only to authenticated admins. `GET /api/v1/projects?includeArchived=true` includes archived projects only for admins. Both collections support pagination and literal-text search. Public requests cannot override these visibility rules.

Deploy the backend and frontend together. The editors now persist create, update, and delete operations through the API. Hard-coded blog and project samples are removed without importing them into the database; empty collections stay empty until an admin publishes content.

### Student Administrators

An existing administrator can grant or remove student admin access in **Admin > Members** using the shield control. Students default to the `student` role; registration and profile updates cannot grant permissions. After a grant, the student can reload or sign in again to see the **Student / Admin** dashboard switch. No separate admin password is needed.

`PATCH /api/v1/students/:id/role` accepts `{ "role": "admin" }` or `{ "role": "student" }` and requires administrator authorization. Self-demotion is blocked. Removing access takes effect on the next admin API request while preserving the student account and existing content.

Each student admin has an internal User record to preserve existing content ownership references. Its reserved `@accounts.comes.invalid` address is not a delivery address, and direct user login/token authorization is blocked for these records. Admin API requests validate the student session, current student role, and linked administrator status. Do not manually promote students by editing only the role field; use the endpoint so the ownership link is created.

### Password Recovery

Both login screens offer password recovery. A request sends a single-use confirmation link valid for 10 minutes. The current password stays unchanged until the owner confirms the link. Confirmation generates a cryptographically random password, stores its bcrypt hash, revokes existing sessions, and emails the new password. The API never returns the password or automatically signs the user in. Users should change the emailed password after signing in.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and the public `FRONTEND_URL` before enabling recovery in production. Missing SMTP credentials prevent email delivery. If sending the generated password fails, the previous password is restored unless another password change has already occurred; request a new recovery link to retry. Recovery requests are IP-rate-limited and have a one-minute per-account email cooldown. Unknown emails receive the same response as registered emails.

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/logout` | Logout user |
| POST | `/api/v1/auth/refresh-token` | Refresh access token |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| PATCH | `/api/v1/auth/reset-password/:token` | Confirm reset and email a random password (no password body) |
| POST | `/api/v1/students/forgot-password` | Request student password reset |
| PATCH | `/api/v1/students/reset-password/:token` | Confirm student reset and email a random password |
| PATCH | `/api/v1/auth/update-password` | Update password (protected) |
| GET | `/api/v1/auth/me` | Get current user (protected) |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | Get all users |
| GET | `/api/v1/users/:id` | Get user by ID |
| PATCH | `/api/v1/users/me` | Update current user |
| DELETE | `/api/v1/users/me` | Delete current user |
| PATCH | `/api/v1/users/:id` | Update user (admin) |
| DELETE | `/api/v1/users/:id` | Delete user (admin) |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/events` | Get all events |
| GET | `/api/v1/events/featured` | Get featured events |
| GET | `/api/v1/events/:id` | Get event by ID |
| GET | `/api/v1/events/slug/:slug` | Get event by slug |
| POST | `/api/v1/events` | Create event (admin) |
| PATCH | `/api/v1/events/:id` | Update event (admin) |
| DELETE | `/api/v1/events/:id` | Delete event (admin) |
| POST | `/api/v1/events/:id/register` | Register for event |
| DELETE | `/api/v1/events/:id/register` | Unregister from event |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects` | Get all projects |
| GET | `/api/v1/projects/featured` | Get featured projects |
| GET | `/api/v1/projects/categories` | Get project categories |
| GET | `/api/v1/projects/:id` | Get project by ID |
| GET | `/api/v1/projects/slug/:slug` | Get project by slug |
| POST | `/api/v1/projects` | Create project (admin) |
| PATCH | `/api/v1/projects/:id` | Update project (admin) |
| DELETE | `/api/v1/projects/:id` | Delete project (admin) |
| POST | `/api/v1/projects/:id/like` | Like a project |

### Blog
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/blog` | Get all posts |
| GET | `/api/v1/blog/featured` | Get featured posts |
| GET | `/api/v1/blog/categories` | Get blog categories |
| GET | `/api/v1/blog/tags` | Get blog tags |
| GET | `/api/v1/blog/:id` | Get post by ID |
| GET | `/api/v1/blog/slug/:slug` | Get post by slug |
| POST | `/api/v1/blog` | Create post (admin) |
| PATCH | `/api/v1/blog/:id` | Update post (admin) |
| DELETE | `/api/v1/blog/:id` | Delete post (admin) |
| POST | `/api/v1/blog/:id/like` | Like a post |

### Contact
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/contact` | Submit contact form |
| GET | `/api/v1/contact` | Get all contacts (admin) |
| GET | `/api/v1/contact/:id` | Get contact by ID (admin) |
| POST | `/api/v1/contact/:id/reply` | Reply to contact (admin) |
| PATCH | `/api/v1/contact/:id` | Update contact (admin) |
| DELETE | `/api/v1/contact/:id` | Delete contact (admin) |

### Newsletter
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/newsletter/subscribe` | Subscribe to newsletter |
| POST | `/api/v1/newsletter/unsubscribe` | Unsubscribe from newsletter |
| GET | `/api/v1/newsletter` | Get all subscribers (admin) |
| GET | `/api/v1/newsletter/export` | Export subscribers CSV (admin) |
| DELETE | `/api/v1/newsletter/:id` | Delete subscriber (admin) |

### Team
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/team` | Get all team members |
| GET | `/api/v1/team/department/:department` | Get members by department |
| GET | `/api/v1/team/:id` | Get member by ID |
| POST | `/api/v1/team` | Create member (admin) |
| PATCH | `/api/v1/team/:id` | Update member (admin) |
| DELETE | `/api/v1/team/:id` | Delete member (admin) |
| PATCH | `/api/v1/team/reorder` | Reorder members (admin) |

## 🔒 Security Best Practices

1. **Never commit `.env` file** - It contains sensitive data
2. **Use strong JWT secrets** - At least 32 characters, randomly generated
3. **Enable HTTPS in production** - Use a reverse proxy like Nginx
4. **Regular dependency updates** - Run `npm audit` periodically
5. **Database security** - Use authentication and restrict network access
6. **Rate limiting** - Adjust limits based on your needs

## 📝 License

MIT License - See LICENSE file for details
