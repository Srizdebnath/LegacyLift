const isProd = process.env.NODE_ENV === 'production';

export const API_URL = isProd 
  ? 'https://legacylift-backend.onrender.com' 
  : 'http://localhost:5000';