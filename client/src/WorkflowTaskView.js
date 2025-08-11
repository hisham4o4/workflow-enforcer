import React from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const WorkflowTaskView = ({ tasks, token, onDataChange }) => {
    
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Delete this task permanently?")) return;
        try {
            await axios.delete(`${API_URL}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
            onDataChange(); // Trigger data refresh in parent
        } catch (error) {
            alert('Failed to delete task.');
        }
    };

    return (
        <div className="workflow-task-container"> {/* Add overflow-x: auto; to this class */}
            <h3>Task Flow</h3>
            <div className="task-flow-canvas"> {/* This will be your scrollable area */}
                {tasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                        <div className="task-node-card">
                            <div className="task-node-header">
                                <strong>{task.title}</strong>
                                <div>
                                    {/* Feature 2: Admin can see if task was seen */}
                                    {task.seen_at && <span className="seen-indicator" title={`Seen on: ${new Date(task.seen_at).toLocaleString()}`}>✔️</span>}
                                    <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)}>×</button>
                                </div>
                            </div>
                            <div className="task-node-body">
                                <p>Assignee: {task.assignee_name || 'N/A'}</p>
                                <p>Status: {task.status}</p>
                            </div>
                        </div>
                        {/* Feature 3: Render a connecting arrow if it's not the last task */}
                        {index < tasks.length - 1 && (
                            <div className="task-arrow">→</div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default WorkflowTaskView;