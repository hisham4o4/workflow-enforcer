import React, { useState } from 'react';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Main Application Component
 * Handles authentication and routing between admin/user dashboards
 */
function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Get token and user from localStorage with fallback
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token');
    } catch (e) {
      return null;
    }
  });
  
  const [user, setUser] = useState(() => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      return null;
    }
  });

  /**
   * Handles form submission for login/register
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!username.trim() || !password.trim()) {
      setMessage('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    const endpoint = isLogin ? '/login' : '/register';
    
    try {
      const response = await axios.post(`${API_URL}${endpoint}`, { 
        username: username.trim(), 
        password 
      });
      
      if (isLogin) {
        // Store auth data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setToken(response.data.token);
        setUser(response.data.user);
        setMessage('Login successful!');
      } else {
        setMessage('Registration successful! Please log in.');
        setIsLogin(true);
        setPassword(''); // Clear password after registration
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'An error occurred.';
      setMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles user logout
   */
  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {
      console.warn('Failed to clear localStorage');
    }
    setToken(null);
    setUser(null);
    setUsername('');
    setPassword('');
    setMessage('');
  };

  // Render dashboard for authenticated users
  if (token && user) {
    return (
      <div className="app-container">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <div className="header-info">
              <h1 className="welcome-title">Welcome, {user.username}!</h1>
              <p className="user-info">
                Role: {user.role >= 3 ? 'Admin' : user.role >= 2 ? 'Manager' : user.role >= 1 ? 'Supervisor' : 'Designer'}
                {user.score !== undefined && <span className="score-badge">Score: {user.score}</span>}
              </p>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
          
          <div className="dashboard-content">
            {user.role >= 3 ? (
              <AdminDashboard token={token} user={user} />
            ) : (
              <UserDashboard token={token} user={user} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render authentication form
  return (
    <div className="app-container">
      <div className="auth-container">
        <h1 className="auth-title">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>
          
          <button 
            className="btn-primary" 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
        
        <button 
          className="btn-secondary" 
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage('');
            setPassword('');
          }}
          disabled={isLoading}
        >
          {isLogin ? 'Need an account?' : 'Already have an account?'}
        </button>
        
        {message && (
          <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;