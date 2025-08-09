const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    family: 4, 
});


// Run the CREATE TABLE scripts in the Supabase SQL Editor one time!

module.exports = {
    query: (text, params) => pool.query(text, params),
};
