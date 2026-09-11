import axios from 'axios';

// Allows configuring custom backend API URL (e.g. Render URL when frontend is hosted on Netlify)
export const getApiBaseUrl = () => {
  return localStorage.getItem('motorsense_api_url') || import.meta.env.VITE_API_URL || '';
};

export const setApiBaseUrl = (url) => {
  if (url) {
    localStorage.setItem('motorsense_api_url', url.replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('motorsense_api_url');
  }
};

const api = axios.create({
  timeout: 600000,
});

api.interceptors.request.use((config) => {
  const base = getApiBaseUrl();
  if (base && config.url && config.url.startsWith('/api')) {
    config.url = base + config.url;
  }
  return config;
});

export default api;
