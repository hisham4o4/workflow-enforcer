import React, { useState } from 'react';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import './App.css'; // Add this import

const API_URL = process.env.REACT_APP_API_URL;

function App() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = isLogin ? '/login' : '/register';
        try {
            const response = await axios.post(`${API_URL}${endpoint}`, { username, password });
            if (isLogin) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setToken(response.data.token);
                setUser(response.data.user);
                setMessage('Login successful!');
            } else {
                setMessage('Registration successful! Please log in.');
                setIsLogin(true);
            }
        } catch (error) {
            setMessage(error.response?.data?.message || 'An error occurred.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    if (token && user) {
      return (
          <div>
              <h1>Welcome, {user.username}!</h1>
              <button onClick={handleLogout}>Logout</button>
              <hr />
              {user.role === 3 ? ( // Role 3 is Admin
                  <AdminDashboard token={token} />
              ) : (
                  // Pass the full user object to the dashboard
                  <UserDashboard token={token} user={user} /> 
              )}
          </div>
      );
  }

  return (
    <div className="app-container">
      <div className="auth-container">
        <h1 className="auth-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              className="form-input"
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              className="form-input"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button className="btn-primary" type="submit">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <button className="btn-secondary" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account?' : 'Already have an account?'}
        </button>
        {message && <p className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</p>}
      </div>
    </div>
  );


if (token && user) {
  return (
    <div className="app-container">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1 className="welcome-title">Welcome, {user.username}!</h1>
            <p className="user-info">Role: {user.role === 1 ? 'Admin' : 'User'}</p>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
        {user.role === 1 ? (
          <AdminDashboard token={token} />
        ) : (
          <UserDashboard token={token} />
        )}
      </div>
    </div>
  );
}

}

export default App;