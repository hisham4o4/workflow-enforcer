import React from 'react';

const DashboardGreeting = ({ userRole }) => {
    const messages = {
        Admin: "Select a workflow from the list to begin managing tasks and dependencies.",
        User: "Here you can view your assigned tasks and create new tasks for your colleagues."
    };

    return (
        <div className="dashboard-greeting">
            <h3>Welcome to your Dashboard</h3>
            <p>{messages[userRole] || "Select an item to get started."}</p>
        </div>
    );
};

export default DashboardGreeting;