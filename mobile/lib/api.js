import axios from "axios";
import { API_URL } from "./config";
import { getToken } from "./storage";

let _onUnauthorized = null;

export function setOnUnauthorized(cb) {
  _onUnauthorized = cb;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 90000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
