# ComES Backend API

A secure, production-ready Node.js/Express backend for the ComES website.

## Event Organizing Committees

Each event may have registered student members with an OC role, team, explicit `isChair` permission, and contribution notes. Committee data is excluded from public event responses. Chair access does not change a student's global role and is checked atomically on event/contribution writes. Only administrators manage assignments; role names alone never grant chair access.

The public `GET /events/:id/organizers` endpoint returns only each member's name, role, and team for read-only tables. Deleted student accounts are omitted. Registration numbers, account IDs, emails, contribution notes, and chair permissions are not exposed.

Event editors support an optional HTTP/HTTPS image URL and end date/time (send `endDate: null` to clear it). When both dates are submitted, the end must be after the start. New categories are Competition, Workshop, and Other. Existing Hackathon, Seminar, and Social records serialize and filter as Competition, Workshop, and Other respectively; no destructive migration is needed.

Registration defaults to `registrationMode: "platform"`. Admins and assigned chairs can select `"custom"` with an HTTP/HTTPS `registrationUrl`; submit both fields when changing a custom link. Switching to platform sends an empty URL. Custom links open in a new tab on public and student pages, and custom-link events reject platform enrollment requests. Existing status, date, and capacity restrictions still apply; external registrations are not synchronized into platform counts.

Admins and assigned chairs can choose **Upload event image**, position the image, select its aspect ratio, zoom, rotate, and reset the crop before choosing **Crop & upload**. JPEG, PNG, and WebP source files up to 3 MB and 24 megapixels are supported. The browser exports the crop as JPEG (transparent areas become white), capped at 1920 pixels on the longest edge, then uploads that file to Cloudinary's `comes/events` folder. Both image endpoints accept one multipart `image` and return `{ success: true, data: { url } }`. The URL is saved to the event only when the event form is submitted. Cancelling a crop or a failed upload preserves the previous image; uploaded Cloudinary assets are not automatically deleted when an image is removed or the editor is cancelled.

Event uploads use the same backend-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` settings as committee photos. No new environment variables or unsigned preset are required. The chair endpoint checks current assignment before uploading and before returning the URL; saving event details also rechecks chair access.

All paths below are relative to `/api/v1`:

| Method | Path | Access |
| --- | --- | --- |
| POST | `/events/image` | Admin; crop image upload for new or existing events |
| POST | `/students/organized-events/:id/image` | Currently assigned chair; event image upload |
| GET | `/events/committee-members?search=...` | Admin; limited student name/registration/username search |
| GET | `/events/:id/committee` | Admin; event and populated committee |
| PUT | `/events/:id/committee/:memberId` | Admin; `{role, team, isChair}`; preserves contributions |
| DELETE | `/events/:id/committee/:memberId` | Admin; removes assignment and chair access |
| PATCH | `/events/:id/committee/:memberId/contributions` | Admin; `{contributions}` |
| GET | `/students/organized-events` | Student; only their chair assignments |
| GET | `/students/organized-events/:id` | Assigned chair; event and committee |
| PATCH | `/students/organized-events/:id` | Assigned chair; allowlisted event details only |
| PATCH | `/students/organized-events/:id/committee/:memberId/contributions` | Assigned chair; `{contributions}` for a member of that event |

Assignment roles and teams are required and limited to 100 characters; contributions are limited to 5,000 characters and may be cleared. Invalid member IDs, nonexistent students, and unsupported fields are rejected. Existing events need no data migration; committees default to an empty list. Coverage: `tests/eventCommittee.controller.test.js`.

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
| `CLOUDINARY_CLOUD_NAME` | Cloudinary product environment cloud name for committee and event images | - |
| `CLOUDINARY_API_KEY` | Cloudinary API key (backend only) | - |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (backend only) | - |

### Executive Committee Details

Administrators, including authorized student admins, manage committee records at **Admin > Committee & Team** (`/admin/team`). Select the Executive Committee department to edit names, positions, photos, biographies, contact details, social links, display order, term dates, and visibility. Inactive records remain available in the admin list for reactivation but are excluded from public lists and public detail requests.

The public `/team` page reads saved, active API records rather than hard-coded profiles. Before deploying this frontend change, publish the desired committee records. The Add Member editor offers the previous executive roster as optional starting entries; select a member, supply the batch and correct term dates, then save. Other team and advisor records can be added directly. No existing profiles are automatically imported and no database records are changed by loading the editor.

`GET /api/v1/team?includeInactive=true` includes inactive records only when authenticated as an admin. All create, update, delete, and reorder operations remain admin-only.

#### Cloudinary Photos

#### Event Gallery

The public `/gallery` page reads saved gallery records, not sample data or event cover images. In **Admin > Gallery**, select an event, choose up to 20 photographs, edit titles/captions, and select **Save photos**. Each JPEG, PNG, or WebP file must be at most 3 MiB. Uploads run sequentially, preserving original framing. Clear **Publish photos** to save drafts; published images appear immediately in the public event-filtered archive. Admins can edit captions, publish/unpublish, and confirm removal from the gallery.

Gallery uploads reuse the backend Cloudinary credentials below and use the `comes/gallery` folder. `POST /api/v1/gallery/upload` returns the Cloudinary URL; `POST /api/v1/gallery` persists that URL with its event and metadata in MongoDB. Failed metadata saves retain the URL in the current upload queue so retry does not upload the same file again. Keep the page open until saving finishes. Removing a record or abandoning an upload does not delete the Cloudinary asset; unused assets must be removed separately in Cloudinary.

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/v1/gallery` | Public published photos; `event`, `page`, `limit` (max 60); `includeUnpublished=true` is honored only for authenticated admins |
| GET | `/api/v1/gallery/albums` | Public event albums with published-photo counts |
| POST | `/api/v1/gallery/upload` | Admin, multipart field `image`, max 3 MiB |
| POST | `/api/v1/gallery` | Admin; event ID, title, Cloudinary HTTPS image URL, optional description and isPublished |
| PATCH | `/api/v1/gallery/:id` | Admin; event, title, description, isPublished |
| DELETE | `/api/v1/gallery/:id` | Admin; removes metadata only |

#### Cloudinary Configuration

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend `.env` for local development and in the backend hosting environment for production, then restart/redeploy the backend. Get these values from your Cloudinary product environment's API Keys settings. Never put the API secret in frontend/Vite environment variables or commit real credentials. No unsigned upload preset is required.

In **Admin > Committee & Team**, add or edit a member and choose **Upload photo**. JPEG, PNG, and WebP images up to 3 MB are accepted. The admin-only `POST /api/v1/team/avatar` accepts a single multipart `image` file, validates limits, and sends it to Cloudinary's `comes/team` folder. It returns `{ success: true, data: { url } }`. The editor previews the uploaded image; **Add Member** or **Update Member** persists that URL. An existing Cloudinary image URL can also be pasted into **Avatar URL**. Missing Cloudinary configuration returns 503 without affecting other team features.

Uploads occur before the member record is saved. Cancelling the editor, replacing an image, removing a photo, or deleting a member does not delete assets from Cloudinary because URLs may be shared by other records. Remove unused assets separately in Cloudinary. Credentials and upload signing stay on the backend; only the public image URL is returned to the frontend.

#### Student Profile Photos

At `/student/profile`, use the camera button to choose a JPEG, PNG, or WebP image up to 3 MiB. Photos save immediately, independently of **Save Changes**; unsaved profile text is preserved. Progress, validation errors, and retry are available, and a failed upload keeps the previous photo.

`POST /api/v1/students/me/avatar` requires a student access token (including linked student admins) and accepts a single multipart `image` with no other fields. It reuses the backend Cloudinary credentials above, uploads to `comes/profiles`, updates only the authenticated student's `avatar`, and returns `{ success: true, data: { student } }`. A standalone staff token cannot select another student's profile. The frontend refreshes its persisted student session from this response. Missing configuration returns 503. Replaced or orphaned Cloudinary assets are not deleted automatically; remove unused assets separately.

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
| POST | `/api/v1/team/avatar` | Upload a committee photo to Cloudinary (admin) |
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
