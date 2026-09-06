# ElectroHire
A local service-provider marketplace — find, contact, book, and rate electricians, plumbers, tutors, and other service providers in your area.
Built with Django REST Framework (backend) and React + Vite (frontend), with real-time chat over WebSockets.

Table of Contents
Overview
Features
Tech Stack
Project Structure
Getting Started
Prerequisites
Backend Setup
Frontend Setup
Environment Variables
API Overview
Real-Time Chat (WebSocket)
Running Tests
Roadmap
Contributing
License

Overview

ElectroHire connects users who need a service done with providers who offer that service. A user searches by category and area, views a provider's public profile and reviews, contacts them (with an optional real-time chat), requests a booking, and afterwards leaves a rating. Providers manage their own profile, respond to messages, and track bookings and reviews from a dedicated dashboard. Admins approve new providers and moderate reports from the Django Admin panel.

The project is deliberately split into two independent, decoupled apps — a Django REST API and a React SPA — communicating only over HTTP/JSON and WebSockets, so either side can be developed, tested, or deployed on its own.

Features

Accounts & Auth

Email/password signup with OTP email verification (console-backend in dev)
JWT-based login with automatic access-token refresh (silent, on 401)
Forgot / reset password via OTP, change password while logged in, account deletion
Role-based accounts: user, provider, admin

Providers & Discovery

Multi-step provider profile setup (photo, categories, area, experience, bio)
Admin approval workflow: pending → active / rejected
Public provider directory with filtering by category, area, and sorting by rating
Public provider detail page with aggregated rating, review count, and reviews list

Contact, Chat & Bookings

Contact log created on first contact/number-reveal (used to gate ratings)
Real-time one-to-one chat per user↔provider pair over WebSockets, with conversation list, unread counts, and read receipts
Booking requests (date, time, address, notes) with a status lifecycle: pending → confirmed → completed, plus cancelled / rejected

Trust & Safety

Star rating + tags + written review, restricted to users who've actually contacted that provider
Reporting system for both users and providers, with predefined reasons and admin moderation (resolve/dismiss)

Admin

Customized Django Admin with a dashboard (total users, total providers, contact rate, pending approvals)
Provider approve/reject actions, category management, report moderation

Platform / Engineering

Consistent API response envelope across every endpoint (see API Overview)
Per-endpoint rate limiting (login, OTP, registration, password reset)
Environment-based configuration (.env) — no secrets in source control
Production security headers (HSTS, secure cookies, SSL redirect) auto-enabled when DEBUG=False
400+ automated tests across backend and frontend
Tech Stack
Layer	Technology
Backend framework	Django 6.0, Django REST Framework 3.18
Auth	djangorestframework-simplejwt (JWT access + refresh tokens)
Real-time	Django Channels 4 + Daphne (ASGI), Redis-backed channel layer in production
Database	SQLite (development) — swappable via DATABASES in settings.py
Backend testing	Django's built-in test runner (manage.py test)
Frontend framework	React 19 + Vite
Routing	React Router 7
Styling / UI	Tailwind CSS 4, shadcn/ui (Radix primitives + class-variance-authority), lucide-react icons
HTTP client	Axios (with interceptor-based token refresh)
Frontend testing	Vitest + React Testing Library
Project Structure

The codebase is split into two top-level, independently runnable projects — not a single monolithic file — organized by Django "app" (backend) and by responsibility (frontend):

ElectroHire/
├── requirements.txt              # Backend Python dependencies (pinned)
├── backend/                      # Django REST API
│   ├── manage.py
│   ├── electrohire/              # Project config
│   │   ├── settings.py
│   │   ├── urls.py               # Root URL routing (mounts every app below)
│   │   └── asgi.py               # HTTP + WebSocket entry point (Channels)
│   ├── users/                    # Custom User model, auth, OTP, JWT views
│   ├── categories/               # Service categories (Electrician, Plumber, ...)
│   ├── providers/                # Provider profiles, directory, dashboard
│   ├── contacts/                 # Contact log + real-time chat (consumers, routing)
│   ├── bookings/                 # Booking requests & status lifecycle
│   ├── ratings/                  # Ratings & reviews (contact-gated)
│   ├── reports/                  # User/provider reporting & moderation
│   └── core/                     # Shared response envelope, exception handling, admin dashboard
│
└── frontend/                     # React + Vite SPA
    ├── package.json
    ├── index.html
    └── src/
        ├── pages/                # One file per route (LoginPage, ProvidersPage, ChatsPage, ...)
        ├── components/           # Reusable UI, grouped by feature (chat/, providers/, dashboard/, ui/, ...)
        ├── hooks/                # Data-fetching hooks (useProviders, useChatThread, useMyBookings, ...)
        ├── services/              # API clients, one per domain (authService, bookingService, chatSocket, ...)
        ├── context/               # AuthContext (session state)
        ├── lib/                  # Formatting, validation, small utilities
        └── test/                 # Vitest + Testing Library specs, mirroring pages/components

Each Django app follows the same internal shape (models.py, serializers.py, views.py, urls.py, admin.py, tests.py), and each frontend feature follows the same pattern (a page, one or more hooks, a service, and its own test file) — new features should follow the existing app/feature they resemble most closely rather than introducing a new pattern.

Getting Started
Prerequisites
Python 3.11+
Node.js 20+ and npm
(Optional, production-like setups only) Redis — needed only once REDIS_URL is set; local dev works without it
Backend Setup
bash
cd backend

# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies (from the repo root's requirements.txt)
pip install -r ../requirements.txt

# 3. Configure environment variables
cp .env.example .env            # defaults already work for local dev

# 4. Apply migrations
python manage.py migrate

# 5. Create an admin account
python manage.py createsuperuser   # prompts for email, name, password

# 6. Run the development server
python manage.py runserver

The API is now available at http://127.0.0.1:8000/api/, and the Django Admin at http://127.0.0.1:8000/admin/.

Signup sends an OTP email — in development (DEBUG=True), it's printed straight to this terminal instead of actually being emailed.

Frontend Setup
bash
cd frontend

# 1. Install dependencies
npm install

# 2. (Optional) point the app at a non-default API URL
echo "VITE_API_BASE_URL=http://127.0.0.1:8000/api" > .env

# 3. Run the development server
npm run dev

The app is now available at http://localhost:5173. With no .env file, it falls back to http://127.0.0.1:8000/api automatically, which matches the backend's default port above.

Environment Variables

backend/.env (see backend/.env.example for the authoritative, commented list):

Variable	Required	Default (dev)	Purpose
DEBUG	No	True	Enables debug pages, console email backend, relaxed cookies
SECRET_KEY	Yes when DEBUG=False	insecure dev key	Django cryptographic signing key
ALLOWED_HOSTS	Yes when DEBUG=False	(empty)	Comma-separated hostnames this API may serve
CORS_ALLOWED_ORIGINS	No	localhost:5173, localhost:3000	Comma-separated frontend origins allowed to call the API
REDIS_URL	No	(unset — uses in-memory backend)	Shared channel layer + throttle cache for multi-process/production deployments

frontend/.env (optional):

Variable	Required	Default	Purpose
VITE_API_BASE_URL	No	http://127.0.0.1:8000/api	Base URL the frontend sends all API requests to
API Overview

Every endpoint returns the same JSON envelope, so success/error handling on the frontend is uniform:

jsonc
// Success
{ "status": "success", "message": "...", "data": { /* ... */ } }

// Error
{ "status": "error", "message": "..." }

All routes are mounted under /api/. A representative selection:

Area	Endpoint	Description
Auth	POST /api/auth/register/	Create an account, triggers OTP email
Auth	POST /api/auth/verify-otp/	Verify OTP, returns JWT pair
Auth	POST /api/auth/login/	Login, returns JWT pair
Auth	POST /api/auth/refresh/	Exchange refresh token for a new access token
Auth	GET /api/auth/me/	Current authenticated user
Auth	POST /api/auth/forgot-password/ / reset-password/	OTP-based password reset
Categories	GET /api/categories/	List all service categories (public)
Providers	GET /api/providers/?category=&area=&sort=rating	Public, filterable/sortable provider directory
Providers	GET /api/providers/{id}/	Public provider detail
Providers	POST /api/providers/profile/	Create/update the authenticated user's provider profile
Providers	GET /api/providers/dashboard/	Authenticated provider's own stats
Providers	GET /api/providers/{id}/ratings/	Ratings for a specific provider
Contacts	POST /api/contacts/	Log a contact / reveal a number
Contacts	GET /api/contacts/conversations/	Conversation list with unread counts
Contacts	`GET	POST /api/contacts/messages/{provider_id}/`
Bookings	POST /api/bookings/	Create a booking request
Bookings	GET /api/bookings/mine/ / provider/	A user's or provider's bookings
Bookings	PATCH /api/bookings/{id}/status/	Update booking status
Ratings	POST /api/ratings/	Submit a rating (requires a prior contact)
Reports	POST /api/reports/	Report a user or provider
Real-Time Chat (WebSocket)

Chat runs over Django Channels, mirroring the REST message thread route:

ws://127.0.0.1:8000/ws/chat/{provider_id}/

The connection is authenticated via the JWT access token (passed as a query parameter, since there's no session cookie to rely on), and the server validates the WebSocket Origin header against the same CORS_ALLOWED_ORIGINS list used for REST requests.

Running Tests

Backend (216 tests, Django's built-in test runner):

bash
cd backend
python manage.py test

Frontend (211 tests, Vitest + React Testing Library):

bash
cd frontend
npm test

Both suites are self-contained (in-memory/isolated test DB, mocked API calls) and require no running server or external services.

Roadmap
Migrate from SQLite to PostgreSQL for production
Containerize both apps (Docker Compose) for one-command local setup
Deploy backend + frontend + Redis to a production host
Push notifications for new messages/booking updates
Pagination on the provider directory and conversation list
Contributing
Fork the repo and create a feature branch off main.
Follow the existing structure for whichever app/feature you're touching (see Project Structure) rather than introducing a new pattern.
Add or update tests alongside any change — manage.py test and npm test should both stay green.
Open a pull request with a clear description of the change and why it's needed.
License

This repository doesn't currently include a license file, which by default means all rights are reserved and the code isn't licensed for reuse. If you intend for others to use, modify, or contribute to it, consider adding one — choosealicense.com is a good starting point (MIT is a common, permissive choice for portfolio/student projects).
