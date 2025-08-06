import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Helper function to determine the style of a task based on its status
const getTaskStyle = (status) => {
    switch (status) {
        case 'overdue':
            return { border: '2px solid red', backgroundColor: '#fff0f0' };
        case 'pending':
            return { border: '1px solid #ccc' };
        default:
            return { border: '1px solid #ccc' };
    }
};

const UserDashboard = ({ token }) => {
    const [tasks, setTasks] = useState([]);
    const [message, setMessage] = useState('');

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/mytasks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTasks(response.data);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
            setMessage('Could not load tasks.');
        }
    };

    useEffect(() => {
        fetchTasks();
        // Set up an interval to refresh tasks every 30 seconds
        const intervalId = setInterval(fetchTasks, 30000); 
        // Clean up the interval on component unmount
        return () => clearInterval(intervalId);
    }, [token]);

    const handleCompleteTask = async (taskId) => {
        try {
            const response = await axios.post(`${API_URL}/tasks/${taskId}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(response.data.message || 'Task completed!');
            fetchTasks(); // Refresh the list immediately
        } catch (error) {
            setMessage(error.response?.data?.message || 'Could not complete task.');
        }
    };

    return (
        <div>
          <h2 className="panel-title">My Tasks</h2>
          {message && <p className={`message ${message.includes('completed') ? 'success' : 'error'}`}>{message}</p>}
          
          {tasks.length === 0 ? (
            <div className="empty-state">
              <h3>No tasks assigned</h3>
              <p>You're all caught up! 🎉</p>
            </div>
          ) : (
            <div className="task-grid">
              {tasks.map(task => (
                <div key={task.id} className={`task-card ${task.status}`}>
                  <h3 className="task-title">{task.title}</h3>
                  <span className={`task-status ${task.status}`}>{task.status}</span>
                  <p className="task-due">Due: {new Date(task.due_date).toLocaleString('en-AU')}</p>
                  
                  {task.blocked_by_count > 0 ? (
                    <div className="task-blocked">
                      Blocked: Waiting for prerequisite tasks
                    </div>
                  ) : (
                    <button 
                      className="btn-complete" 
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={task.status === 'completed'}
                    >
                      Mark as Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
};

export default UserDashboard;