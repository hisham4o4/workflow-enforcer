import React, { useState } from 'react';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';

const API_URL = '/api';

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
              {user.role === 1 ? (
                  <AdminDashboard token={token} />
              ) : (
                <UserDashboard token={token} />  // Placeholder for UserDashboard or was
              )}
          </div>
      );
  }

    return (
        <div>
            <h1>{isLogin ? 'Login' : 'Register'}</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Username:</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div>
                    <label>Password:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <button onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Need to register?' : 'Already have an account?'}
            </button>
            {message && <p>{message}</p>}
        </div>
    );
}

export default App;