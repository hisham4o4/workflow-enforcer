const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const initializeDb = async () => {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database.');

    // Note: Unlike SQLite, we don't run CREATE TABLE on every connect.
    // You should run these queries once using the Supabase SQL Editor.
    // Go to your Supabase project -> SQL Editor -> "New query" and paste the
    // contents from the "CREATE TABLE..." section in the original database.js file.

    client.release();
};

// Run the CREATE TABLE scripts in the Supabase SQL Editor one time!

module.exports = {
    query: (text, params) => pool.query(text, params),
    initializeDb,
};
