import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateTaskForm from './CreateTaskForm';

const API_URL = process.env.REACT_APP_API_URL;

// Helper to determine task card style based on urgency and due date
const getTaskCardClasses = (task) => {
  let classes = 'task-card';
  
  if (task.is_urgent) {
    classes += ' urgent-task';
  } else {
    const hoursUntilDue = (new Date(task.due_date) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) {
      classes += ' overdue-task';
    } else if (hoursUntilDue < 24) {
      classes += ' due-soon-task';
    }
  }
  
  return classes;
};

const UserDashboard = ({ token, user }) => {
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/mytasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      setMessage('Could not load tasks.');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [token]);

  // This effect runs when tasks are loaded to mark them as "seen"
  useEffect(() => {
    tasks.forEach(task => {
      if (task.is_assignee && !task.seen_at) {
        axios.post(`${API_URL}/tasks/${task.id}/seen`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => console.error("Failed to mark as seen", err));
      }
    });
  }, [tasks, token]);

  const handleCompleteTask = async (taskId) => {
    try {
      await axios.post(`${API_URL}/tasks/${taskId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks(); // Refresh list
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not complete task.');
    }
  };

  return (
    <div>
      <h2>My Dashboard</h2>
      {message && <div className="message error"><strong>{message}</strong></div>}
      

      
      <h3>My Tasks & Supervised Tasks</h3>
      
      {tasks.length === 0 ? (
        <div className="task-card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h4 style={{ color: '#48bb78', marginBottom: '1rem' }}>🎉 All caught up!</h4>
            <p style={{ color: '#718096', fontSize: '1.1rem' }}>You have no active tasks. Great job! 👏</p>
          </div>
        </div>
      ) : (
        <div>
          {tasks.map(task => (
            <div key={task.id} className={getTaskCardClasses(task)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, flex: 1, marginRight: '1rem' }}>{task.title}</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {task.is_urgent && (
                    <span style={{ fontWeight: 'bold', color: '#c53030' }}>URGENT</span>
                  )}
                  {task.seen_at && (
                    <span title={`Seen at ${new Date(task.seen_at).toLocaleString()}`}>
                      ✔ Seen
                    </span>
                  )}
                </div>
              </div>
              
              <p><strong>Due:</strong> {new Date(task.due_date).toLocaleString()}</p>
              
              <p>
                <strong>From:</strong> {task.creator_name} → <strong>To:</strong> {task.assignee_name}
                {task.supervisor_name && (
                  <span> (Supervised by: <strong>{task.supervisor_name}</strong>)</span>
                )}
              </p>
              
              {!task.is_assignee && (
                <p style={{ fontStyle: 'italic', color: '#4a5568' }}>
                  You are supervising this task.
                </p>
              )}
              
              {task.is_assignee && (
                <button onClick={() => handleCompleteTask(task.id)}>
                  Mark as Complete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Universal Task Creation Form (for roles that can assign) */}
      {user.role >= 0 && <CreateTaskForm token={token} onTaskCreated={fetchTasks} />}

    </div>

  );
};

export default UserDashboard;