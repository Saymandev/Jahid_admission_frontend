# Frontend - Accounting Management System

Next.js frontend for the Residential & Coaching Accounting Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` (optional, defaults are set):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Features

- **Authentication**: Login with JWT tokens
- **Dashboard**: Real-time statistics and updates
- **Room Management**: Create and manage rooms
- **Student Management**: Add students, assign rooms, track payments
- **Payment Calendar**: Visual calendar view of payment history
- **Coaching Admissions**: Manage coaching admissions and payments
- **Real-Time Updates**: Socket.IO integration for live updates

## Pages

- `/login` - Login page
- `/dashboard` - Main dashboard
- `/dashboard/rooms` - Room management
- `/dashboard/students` - Student list
- `/dashboard/students/[id]` - Student details with payment calendar
- `/dashboard/coaching` - Coaching admissions

## State Management

- **Zustand**: Global auth state
- **React Query**: Server state and caching
- **Socket.IO Client**: Real-time updates

## UI Components

Built with shadcn/ui components and Tailwind CSS, following Google Material Design color palette.

## Build

```bash
npm run build
npm run start
```
