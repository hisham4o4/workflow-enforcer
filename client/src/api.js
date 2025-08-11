/**
 * api.js
 * Centralized axios instance and helpers so the rest of the app uses
 * a single API_URL and consistent headers.
 *
 * Make sure REACT_APP_API_URL is set in your environment.
 */
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach token helper
export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export default api;
