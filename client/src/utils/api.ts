const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

type ReqOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
};

async function request(path: string, options: ReqOptions = {}) {
  const url = `${BACKEND_URL}${path}`;
  const init: RequestInit = {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };

  // Add token if required
  if (options.requiresAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
  }

  if (options.body) init.body = JSON.stringify(options.body);

  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  signup: (data: any) => request('/api/auth/signup', { body: data }),
  verifyOtp: (data: any) => request('/api/auth/verify-otp', { body: data }),
  login: (data: any) => request('/api/auth/login', { body: data }),
  forgotPassword: (data: any) => request('/api/auth/forgot-password', { body: data }),
  resetPassword: (data: any) => request('/api/auth/reset-password', { body: data }),
};

export default api;
