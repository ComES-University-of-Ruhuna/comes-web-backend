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

- Node.js 18+ 
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
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `EMAIL_HOST` | SMTP host | - |
| `EMAIL_PORT` | SMTP port | - |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASS` | SMTP password | - |
| `EMAIL_FROM` | Default from address | - |

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/logout` | Logout user |
| POST | `/api/v1/auth/refresh-token` | Refresh access token |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| PATCH | `/api/v1/auth/reset-password/:token` | Reset password |
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
