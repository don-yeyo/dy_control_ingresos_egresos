const pool = require('./server/config/db');

async function test() {
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        console.log('Connection test successful:', rows[0].result);
        process.exit(0);
    } catch (err) {
        console.error('Connection test failed:', err.message);
        process.exit(1);
    }
}

test();
