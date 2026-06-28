# Student Attendance Frontend

React + Vite frontend cho hệ thống điểm danh sinh viên.

## Chạy local nối backend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Mặc định frontend gọi API:

```text
http://localhost:4000/api
```

## Chạy mock khi backend chưa bật

```bash
cd frontend
$env:VITE_USE_MOCK="true"
npm run dev
```

Tài khoản demo:

```text
admin@school.test / 123456
gv1@school.test / 123456
sv001@school.test / 123456
```
