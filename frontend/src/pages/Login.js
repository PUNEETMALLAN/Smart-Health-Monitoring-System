import React, { useState } from 'react';
import { healthService } from '../services/healthService';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isRegistering) {
        await healthService.register({
          username: formData.username,
          password: formData.password,
          name: formData.name
        });
        setError('Account created! Please log in.');
        setIsRegistering(false);
      } else {
        const userData = await healthService.login({
          username: formData.username,
          password: formData.password
        });
        onLogin(userData);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500">
      {/* Decorative blobs for the glass effect to pop */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-md z-10">
        <div className="bg-white/30 backdrop-blur-lg border border-white/20 shadow-2xl rounded-3xl p-8 text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-sm">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-white/90">
              {isRegistering ? 'Join us for better health tracking' : 'Please enter your details to continue'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <div className="text-left">
                <label className="block text-white text-sm font-semibold mb-2 ml-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-indigo-900 placeholder-indigo-700/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div className="text-left">
              <label className="block text-white text-sm font-semibold mb-2 ml-1">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-indigo-900 placeholder-indigo-700/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
                placeholder="admin"
                required
              />
            </div>
            <div className="text-left">
              <label className="block text-white text-sm font-semibold mb-2 ml-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl bg-white/40 border border-white/40 text-indigo-900 placeholder-indigo-700/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
                placeholder="password"
                required
              />
            </div>

            {error && (
              <div className={`py-2 px-4 rounded-lg text-sm ${error.includes('created') ? 'bg-green-500/40 text-white border border-green-400/50' : 'bg-red-500/40 backdrop-blur-md border border-red-400/50 text-white'}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:bg-white/90 active:scale-95 transition-all duration-200 disabled:opacity-70"
            >
              {isLoading ? 'Processing...' : isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-white/80 hover:text-white text-sm underline underline-offset-4 transition-all"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
