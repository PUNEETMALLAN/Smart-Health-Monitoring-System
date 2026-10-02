import React, { useState } from 'react';
import { healthService } from '../services/healthService';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    blood_group: '',
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
          name: formData.name,
          age: Number(formData.age),
          gender: Number(formData.gender),
          height_cm: formData.height_cm ? Number(formData.height_cm) : null,
          weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
          blood_group: formData.blood_group || null,
        });
        setError('Account created! Please log in.');
        setIsRegistering(false);
        setFormData((current) => ({ ...current, password: '' }));
      } else {
        const userData = await healthService.login({
          username: formData.username,
          password: formData.password,
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
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-card login-brand-card">
          <div className="panel-row title-row small-gap">
            <div className="panel-icon">❤</div>
            <div>
              <strong>Smart Health</strong>
              <small>Your Health, Our Priority</small>
            </div>
          </div>

          <div className="login-welcome">
            <h1>{isRegistering ? 'Create Account' : 'Welcome Back'}</h1>
            <p>{isRegistering ? 'Create your account to continue.' : 'Sign in to access your dashboard.'}</p>
          </div>

          <form className="field-group" onSubmit={handleSubmit}>
            {isRegistering && (
              <>
                <label>
                  <span>Full Name</span>
                  <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleInputChange} required />
                </label>
                <div className="registration-fields">
                  <label>
                    <span>Age</span>
                    <input type="number" name="age" min="18" max="120" placeholder="Age" value={formData.age} onChange={handleInputChange} required />
                  </label>
                  <label>
                    <span>Gender</span>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                      <option value="" disabled>Select</option>
                      <option value="0">Male</option>
                      <option value="1">Female</option>
                    </select>
                  </label>
                  <label>
                    <span>Height (cm) <small>Optional</small></span>
                    <input type="number" name="height_cm" min="50" max="260" step="0.1" placeholder="e.g. 170" value={formData.height_cm} onChange={handleInputChange} />
                  </label>
                  <label>
                    <span>Weight (kg) <small>Optional</small></span>
                    <input type="number" name="weight_kg" min="20" max="500" step="0.1" placeholder="e.g. 65" value={formData.weight_kg} onChange={handleInputChange} />
                  </label>
                  <label className="registration-blood-group">
                    <span>Blood Group <small>Optional</small></span>
                    <select name="blood_group" value={formData.blood_group} onChange={handleInputChange}>
                      <option value="">Prefer not to say</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}

            <label>
              <span>Email or Username</span>
              <input type="text" name="username" placeholder="admin" value={formData.username} onChange={handleInputChange} required />
            </label>

            <label>
              <span>Password</span>
              <input type="password" name="password" placeholder="password" value={formData.password} onChange={handleInputChange} required />
            </label>

            {error && <div className={`message ${error.includes('created') ? 'success' : 'error'}`}>{error}</div>}

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? 'Processing...' : isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <button className="toggle-btn" onClick={() => { setIsRegistering(!isRegistering); setError(''); }}>
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
