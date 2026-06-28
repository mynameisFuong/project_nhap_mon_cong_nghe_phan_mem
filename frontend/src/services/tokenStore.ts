import type { User } from "../types";

const ACCESS_TOKEN = "attendance_access_token";
const REFRESH_TOKEN = "attendance_refresh_token";
const USER = "attendance_user";

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN),
  getUser: (): User | null => {
    const raw = localStorage.getItem(USER);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as User;
      if (!user?.id || !user?.role) {
        tokenStore.clear();
        return null;
      }
      return user;
    } catch {
      tokenStore.clear();
      return null;
    }
  },
  setSession: (user: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem(USER, JSON.stringify(user));
    localStorage.setItem(ACCESS_TOKEN, accessToken);
    localStorage.setItem(REFRESH_TOKEN, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(USER);
    localStorage.removeItem(ACCESS_TOKEN);
    localStorage.removeItem(REFRESH_TOKEN);
  }
};
