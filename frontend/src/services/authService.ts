import type { Role, User } from "../types";
import { apiClient, unwrap, USE_MOCK } from "./apiClient";
import { mockUsers } from "./mockData";

export type LoginResult = { user: User; accessToken: string; refreshToken: string };

export const authService = {
  login: async (email: string, password: string): Promise<LoginResult> => {
    if (USE_MOCK) {
      const user = mockUsers.find((item) => item.email === email) ?? mockUsers[0];
      if (!password) throw new Error("Vui lòng nhập mật khẩu.");
      return { user, accessToken: "mock-access-token", refreshToken: "mock-refresh-token" };
    }
    return unwrap<LoginResult>(apiClient.post("/auth/login", { email, password }));
  },
  logout: async () => {
    if (!USE_MOCK) await apiClient.post("/auth/logout").catch(() => undefined);
  },
  me: () => unwrap<User>(apiClient.get("/auth/me")),
  dashboardPath: (role: Role) => {
    if (role === "ADMIN") return "/admin";
    if (role === "TEACHER") return "/teacher";
    return "/student";
  }
};
