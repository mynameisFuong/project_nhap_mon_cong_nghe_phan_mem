# Student Attendance Backend

Backend cho hệ thống điểm danh sinh viên bằng QR động + OTP 30 giây.

## Stack

- Node.js + Express + TypeScript
- PostgreSQL
- Prisma ORM
- JWT access token + refresh token
- bcrypt password hash
- Multer upload Excel/ảnh/PDF

## Chạy local

```bash
cd backend
copy .env.example .env
npm install
docker compose up -d db
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Nếu không dùng Docker và máy đã có PostgreSQL local, tạo user/database khớp `.env` trước:

```powershell
$env:PGPASSWORD="postgres"
psql -h localhost -U postgres -d postgres -c "CREATE ROLE attendance WITH LOGIN PASSWORD 'attendance';"
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE attendance_db OWNER attendance;"
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

API chạy tại:

```text
http://localhost:4000/api
```

Tài khoản mẫu, mật khẩu đều là `123456`:

```text
admin@school.test
gv1@school.test
gv2@school.test
sv001@school.test
```

## Chạy bằng Docker

```bash
copy backend\.env.example backend\.env
docker compose up --build
```

Sau khi backend container chạy, seed dữ liệu:

```bash
docker compose exec backend npm run prisma:seed
```

## API chính

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/change-password`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/lock`
- `GET/POST/PATCH/DELETE /api/admin/faculties`
- `GET/POST/PATCH/DELETE /api/admin/classes`
- `GET/POST/PATCH/DELETE /api/admin/subjects`
- `GET/POST/PATCH/DELETE /api/admin/semesters`
- `GET/POST/PATCH/DELETE /api/admin/sections`
- `POST /api/admin/sections/:sectionId/import-students`
- `GET /api/teacher/sections`
- `POST /api/teacher/sessions`
- `GET /api/teacher/sessions/:sessionId/qr-otp`
- `POST /api/teacher/sessions/:sessionId/manual-mark`
- `PATCH /api/teacher/sessions/:sessionId/close`
- `GET /api/student/sections`
- `GET /api/student/schedule`
- `POST /api/student/attendance`
- `POST /api/student/leave-requests`

## Test

```bash
cd backend
npm test
```
