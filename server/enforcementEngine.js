const cron = require('node-cron');
const db = require('./database');

const checkOverdueTasks = async () => {
    console.log('Running enforcement engine: Checking for overdue tasks...');
    
    // In PostgreSQL, the 'TEXT' type for due_date can be cast to a timestamp for comparison.
    const sql = `
        UPDATE nodes
        SET status = 'overdue'
        WHERE (due_date::timestamptz) < NOW() AND status = 'pending'
        RETURNING id, assignee_id
    `;

    try {
        const result = await db.query(sql);
        const overdueNodes = result.rows;

        if (overdueNodes.length > 0) {
            console.log(`Found ${overdueNodes.length} overdue tasks.`);
            
            const fineSql = `INSERT INTO fines (user_id, node_id, reason) VALUES ($1, $2, $3)`;
            const scoreSql = `UPDATE users SET score = score - 5 WHERE id = $1`;

            // Loop through each overdue node and apply consequences
            for (const node of overdueNodes) {
                try {
                    // Apply a fine
                    await db.query(fineSql, [node.assignee_id, node.id, 'Missed deadline']);
                    console.log(`Fine applied for node ${node.id} to user ${node.assignee_id}`);
                    
                    // Reduce user's score
                    await db.query(scoreSql, [node.assignee_id]);
                    console.log(`Score reduced for user ${node.assignee_id}`);
                } catch (innerErr) {
                    console.error(`Failed to process consequences for node ${node.id}:`, innerErr);
                }
            }
        }
    } catch (err) {
        console.error("Error checking for overdue tasks:", err.message);
    }
};

const startEngine = () => {
    // Schedule to run every minute.
    cron.schedule('* * * * *', checkOverdueTasks);
};

module.exports = { startEngine };