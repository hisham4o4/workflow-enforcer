import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const CreateTaskForm = ({ token, onTaskCreated }) => {
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [supervisorId, setSupervisorId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get(`${API_URL}/assignable-users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAssignableUsers(res.data);
                if (res.data.length > 0) {
                    setAssigneeId(res.data[0].id); // Default to first user
                }
            } catch (error) {
                console.error("Could not fetch users", error);
            }
        };
        fetchUsers();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const taskData = {
                title,
                assignee_id: assigneeId,
                supervisor_id: supervisorId || null,
                due_date: dueDate,
                is_urgent: isUrgent
            };
            await axios.post(`${API_URL}/tasks`, taskData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Task created successfully!');
            onTaskCreated(); // Callback to refresh parent component's task list
            // Reset form
            setTitle('');
        } catch (error) {
            setMessage(error.response?.data?.message || 'Failed to create task.');
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ddd', margin: '20px 0' }}>
            <h3>Create a New Task</h3>
            <form onSubmit={handleSubmit}>
                <div><input type="text" placeholder="Task Title" value={title} onChange={e => setTitle(e.target.value)} required /></div>
                <div>
                    <label>Assign To:</label>
                    <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required>
                        {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                </div>
                <div>
                    <label>Optional Supervisor:</label>
                    <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)}>
                        <option value="">None</option>
                        {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                </div>
                <div>
                    <label>Due Date:</label>
                    <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                </div>
                <div>
                    <label><input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} /> Mark as Urgent</label>
                </div>
                <button type="submit">Create Task</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default CreateTaskForm;