import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const healthService = {
  async login(credentials) {
    const response = await axios.post(`${API_BASE_URL}/login`, credentials);
    return response.data;
  },
  async register(userData) {
    const response = await axios.post(`${API_BASE_URL}/register`, userData);
    return response.data;
  },
  async verifyEmail(token) {
    const response = await axios.post(`${API_BASE_URL}/verify-email`, { token });
    return response.data;
  },
  async verifyEmailCode(email, code) {
    const response = await axios.post(`${API_BASE_URL}/verify-email-code`, { email, code });
    return response.data;
  },
  async resendVerification(usernameOrEmail) {
    const response = await axios.post(`${API_BASE_URL}/resend-verification`, {
      username_or_email: usernameOrEmail,
    });
    return response.data;
  },
  async forgotPassword(email) {
    const response = await axios.post(`${API_BASE_URL}/forgot-password`, { email });
    return response.data;
  },
  async resetPassword(token, password) {
    const response = await axios.post(`${API_BASE_URL}/reset-password`, { token, password });
    return response.data;
  },
  async analyzeReport(userId, file) {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('file', file);

    const response = await axios.post(`${API_BASE_URL}/analyze-report`, formData);
    return response.data;
  },
  async predictRisk(data) {
    const response = await axios.post(`${API_BASE_URL}/predict`, data);
    return response.data;
  },
  async chat(messages) {
    const response = await axios.post(`${API_BASE_URL}/chat`, { messages });
    return response.data;
  },
  async saveHealthLog(userId, data) {
    const response = await axios.post(`${API_BASE_URL}/user/log?user_id=${userId}`, data);
    return response.data;
  },
  async getUserHistory(userId) {
    const response = await axios.get(`${API_BASE_URL}/user/history/${userId}`);
    return response.data;
  },
  async updateProfile(profile) {
    const response = await axios.post(`${API_BASE_URL}/user/profile`, profile);
    return response.data;
  }
};
