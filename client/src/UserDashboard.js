import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateTaskForm from './CreateTaskForm';
import CountdownTimer from './CountdownTimer'; // Import the new timer

const API_URL = process.env.REACT_APP_API_URL;

const UserDashboard = ({ token, user }) => {
    const [tasks, setTasks] = useState([]);
    const [message, setMessage] = useState('');

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/mytasks`, { headers: { Authorization: `Bearer ${token}` } });
            setTasks(response.data);
        } catch (error) {
            setMessage('Could not load tasks.');
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [token]);
    
    // Find the next upcoming task for the timer
    const nextTask = tasks.find(task => new Date(task.due_date) > new Date());

    return (
        <div>
            <h2>My Dashboard</h2>
            {message && <p><strong>{message}</strong></p>}
            
            {/* Show timer if there's an upcoming task */}
            {nextTask && <CountdownTimer dueDate={nextTask.due_date} />}

            {user.role >= ROLES.DESIGNER && <CreateTaskForm token={token} onTaskCreated={fetchTasks} />}

            <h3>My Tasks & Supervised Tasks</h3>
            {tasks.length === 0 ? (
                <div className="no-tasks-card">
                    <h4>All Caught Up!</h4>
                    <p>You have no active tasks. Well done! 👏</p>
                </div>
            ) : (
                <div>
                    {/* The existing task mapping logic remains the same */}
                    {tasks.map(task => (
                        <div key={task.id} className="task-card">
                            {/* ... task details ... */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserDashboard;