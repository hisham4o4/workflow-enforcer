import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateTaskForm from './CreateTaskForm'; // Import the new form

const API_URL = process.env.REACT_APP_API_URL;

// Helper to determine task card style based on urgency and due date
const getTaskStyle = (task) => {
    const style = { margin: '10px', padding: '15px', borderRadius: '5px' };
    if (task.is_urgent) {
        style.border = '2px solid #e53e3e'; // Red border for urgent
        style.backgroundColor = '#fed7d7';
    } else {
        const hoursUntilDue = (new Date(task.due_date) - new Date()) / (1000 * 60 * 60);
        if (hoursUntilDue < 0) {
            style.border = '2px solid #718096'; // Grey for overdue
            style.backgroundColor = '#e2e8f0';
        } else if (hoursUntilDue < 24) {
            style.border = '2px solid #dd6b20'; // Orange for due soon
            style.backgroundColor = '#feebc8';
        } else {
            style.border = '1px solid #ccc'; // Standard
        }
    }
    return style;
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
            {message && <p><strong>{message}</strong></p>}
            
            {/* Universal Task Creation Form (for roles that can assign) */}
            {user.role > 0 && <CreateTaskForm token={token} onTaskCreated={fetchTasks} />}

            <h3>My Tasks & Supervised Tasks</h3>
            {tasks.length === 0 && <p>You have no active tasks. Great job! 👏</p>}
            <div>
                {tasks.map(task => (
                    <div key={task.id} style={getTaskStyle(task)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h4 style={{ margin: 0 }}>{task.title}</h4>
                            <div>
                                {task.is_urgent && <span style={{fontWeight: 'bold', color: '#c53030'}}>URGENT</span>}
                                {task.seen_at && <span title={`Seen at ${new Date(task.seen_at).toLocaleString()}`}> ✔️ Seen</span>}
                            </div>
                        </div>
                        <p><strong>Due:</strong> {new Date(task.due_date).toLocaleString()}</p>
                        <p>
                            From: <strong>{task.creator_name}</strong> → To: <strong>{task.assignee_name}</strong>
                            {task.supervisor_name && <span> (Supervised by: <strong>{task.supervisor_name}</strong>)</span>}
                        </p>
                        {!task.is_assignee && <p style={{fontStyle: 'italic', color: '#4a5568'}}>You are supervising this task.</p>}

                        {task.is_assignee && (
                            <button onClick={() => handleCompleteTask(task.id)}>Mark as Complete</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UserDashboard;