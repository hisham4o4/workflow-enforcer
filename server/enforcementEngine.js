const cron = require('node-cron');
const db = require('./database');

const checkOverdueTasks = () => {
    console.log('Running enforcement engine: Checking for overdue tasks...');

    const sql = `
        UPDATE nodes
        SET status = 'overdue'
        WHERE due_date < ? AND status = 'pending'
        RETURNING id, assignee_id
    `;
    const now = new Date().toISOString();

    db.all(sql, [now], function (err, overdueNodes) {
        if (err) {
            console.error("Error checking for overdue tasks:", err.message);
            return;
        }

        if (overdueNodes.length > 0) {
            console.log(`Found ${overdueNodes.length} overdue tasks.`);
            const fineSql = `INSERT INTO fines (user_id, node_id, reason) VALUES (?, ?, ?)`;
            const scoreSql = `UPDATE users SET score = score - 5 WHERE id = ?`;

            overdueNodes.forEach(node => {
                // Apply a fine
                db.run(fineSql, [node.assignee_id, node.id, 'Missed deadline'], (fineErr) => {
                    if (fineErr) console.error("Error applying fine:", fineErr.message);
                    else console.log(`Fine applied for node ${node.id} to user ${node.assignee_id}`);
                });

                // Reduce user's score
                db.run(scoreSql, [node.assignee_id], (scoreErr) => {
                    if(scoreErr) console.error("Error reducing score:", scoreErr.message);
                    else console.log(`Score reduced for user ${node.assignee_id}`);
                });
            });
        }
    });
};

const startEngine = () => {
    // Schedule to run every minute for testing.
    // For production, you might run it every hour: '0 * * * *'
    cron.schedule('* * * * *', checkOverdueTasks);
};

module.exports = { startEngine };