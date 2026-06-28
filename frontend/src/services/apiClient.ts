import axios from "axios";
import { tokenStore } from "./tokenStore";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

export const unwrap = <T>(promise: Promise<{ data: { data: T } }>) =>
  promise.then((response) => response.data.data);

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || "Không thể kết nối máy chủ.";
  }
  return error instanceof Error ? error.message : "Có lỗi xảy ra.";
};
