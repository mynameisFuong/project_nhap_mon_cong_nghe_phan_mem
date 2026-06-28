# Test case nghiệp vụ

1. Admin tạo tài khoản: login admin, `POST /api/admin/users`, kiểm tra email unique và role hợp lệ.
2. Admin import Excel: upload file có cột `MSSV`, `Họ tên`, `Lớp`, `Email`; kiểm tra tạo student và enrollment.
3. Teacher tạo phiên: login teacher, `POST /api/teacher/sessions`; một lesson chỉ có một session.
4. Student điểm danh thành công: lấy QR/OTP hiện tại, `POST /api/student/attendance`; tạo record `PRESENT`.
5. OTP sai: submit OTP khác mã hiện tại; trả `INVALID_OTP`.
6. QR hết hạn: submit token window cũ quá hạn; trả `EXPIRED_QR`.
7. Điểm danh hai lần: submit lại cùng phiên; trả `ALREADY_ATTENDED`.
8. Student không thuộc lớp: submit QR của lớp khác; trả `NOT_ENROLLED`.
9. Teacher điểm danh thủ công: `POST /api/teacher/sessions/:id/manual-mark` với reason bắt buộc.
10. Kết thúc phiên: `PATCH /api/teacher/sessions/:id/close`; sinh viên chưa có record thành `ABSENT_UNEXCUSED`.
11. Student gửi đơn xin phép: chỉ cho record đang vắng, bắt buộc file ảnh/PDF.
12. Teacher duyệt/từ chối đơn: cập nhật leave request, tạo notification; duyệt thì record thành `ABSENT_EXCUSED`.
13. Cảnh báo vắng > 20%: tính `số buổi vắng / tổng số buổi * 100`; dùng `absenceThresholdPercent` của course section.
14. Session Lock: student login lần 2 làm `currentSessionId` đổi; token cũ gọi API trả `SESSION_REVOKED`.
