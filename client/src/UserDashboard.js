import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, AlertCircle, CheckCircle, Calendar, User, BarChart3 } from 'lucide-react';

import CreateTaskForm from './CreateTaskForm'; // Assuming this is in the same folder
import CountdownTimer from './CountdownTimer'; // Assuming this is in the same folder
import { ROLES } from './constants'; // Assuming you have a constants file

const API_URL = process.env.REACT_APP_API_URL;

const UserDashboard = ({ token, user }) => {
  // State from the enhanced UI version
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [nextTask, setNextTask] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    urgent: 0,
    overdue: 0
  });

  // Merged fetchTasks function: uses real API call but includes advanced logic
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setMessage(''); // Clear previous messages on new fetch
      
      const response = await axios.get(`${API_URL}/mytasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const fetchedTasks = response.data;
      setTasks(fetchedTasks);

      // --- Logic from the UI-enhanced version ---
      // Calculate stats
      const totalTasks = fetchedTasks.length;
      const completedTasks = fetchedTasks.filter(t => t.status === 'completed').length;
      const urgentTasks = fetchedTasks.filter(t => t.is_urgent && t.status !== 'completed').length;
      const overdueTasks = fetchedTasks.filter(t => {
        return new Date(t.due_date) < new Date() && t.status !== 'completed';
      }).length;

      setStats({
        total: totalTasks,
        completed: completedTasks,
        urgent: urgentTasks,
        overdue: overdueTasks
      });

      // Find next upcoming task
      const upcomingTasks = fetchedTasks
        .filter(task => new Date(task.due_date) > new Date() && task.status !== 'completed')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      
      setNextTask(upcomingTasks[0] || null);

    } catch (error) {
      setMessage('Could not load tasks.');
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
        fetchTasks();
    }
  }, [token]); // Dependency array is correct

  // Helper function to format dates nicely
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to apply CSS classes based on task status
  const getTaskStatusClass = (task) => {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'overdue' || (new Date(task.due_date) < new Date() && task.status !== 'completed')) return 'overdue';
    if (task.is_urgent) return 'urgent';
    return '';
  };

  // Loading state display
  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // --- The new, enhanced JSX for rendering ---
  return (
    <div className="dashboard-content">
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">My Dashboard</h2>
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
      
      {/* Stats Overview */}
      <div className="flow-stats">
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Tasks</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-completed)' }}>{stats.completed}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-urgent)' }}>{stats.urgent}</div><div className="stat-label">Urgent</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-overdue)' }}>{stats.overdue}</div><div className="stat-label">Overdue</div></div>
      </div>

      {/* Next Deadline Card */}
      {nextTask && (
        <div className="deadline-card">
          <div className="deadline-title"><Clock size={20} /> Next Deadline</div>
          <div className="deadline-time"><CountdownTimer dueDate={nextTask.due_date} /></div>
          <div className="deadline-task">{nextTask.title}</div>
        </div>
      )}

      {/* Conditionally render CreateTaskForm for roles higher than Designer */}
      {user.role >= ROLES.SUPERVISOR && <CreateTaskForm token={token} onTaskCreated={fetchTasks} />}

      {/* Tasks Section */}
      <div style={{ marginTop: '2rem' }}>
        <h3 className="section-title">My Tasks & Supervised Tasks</h3>
        {tasks.length === 0 ? (
          <div className="no-tasks-card">
            <CheckCircle size={48} style={{ color: 'var(--status-completed)' }} />
            <h4>All Caught Up!</h4>
            <p>You have no active tasks. Well done! 👏</p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map(task => (
              <div key={task.id} className={`task-card ${getTaskStatusClass(task)}`}>
                <div className="task-header">
                  <h4 className="task-title">{task.title}</h4>
                  <div className="task-badges">
                    {task.is_urgent && (<span className="badge badge-urgent"><AlertCircle size={12} /> Urgent</span>)}
                    {task.seen_at && (<span className="badge badge-seen"><CheckCircle size={12} /> Seen</span>)}
                    {task.blocked_by_count > 0 && (<span className="badge badge-blocked">Blocked ({task.blocked_by_count})</span>)}
                  </div>
                </div>
                <div className="task-details">
                    <p style={{ marginBottom: '0.5rem' }}>{task.description}</p>
                    <div className="task-meta-grid">
                      <div><User size={14} /> <strong>Assigned to:</strong> {task.assignee_name}</div>
                      <div><Calendar size={14} /> <strong>Due:</strong> {formatDate(task.due_date)}</div>
                      <div><BarChart3 size={14} /> <strong>Status:</strong> {task.status}</div>
                      <div><User size={14} /> <strong>Created by:</strong> {task.creator_name}</div>
                    </div>
                </div>
                {/* Task Actions would go here */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;