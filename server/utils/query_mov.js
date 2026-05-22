const pool = require('../config/db');

async function main() {
    try {
        console.log('Querying movimientos columns...');
        const [columns] = await pool.query('DESCRIBE movimientos');
        console.log('Columns:');
        columns.forEach(c => console.log(`  - ${c.Field}: ${c.Type} (${c.Null})`));

        console.log('\nQuerying last 5 movements...');
        const [rows] = await pool.query('SELECT id, personaInterna, fechaHoraRegistro, idEstado FROM movimientos ORDER BY id DESC LIMIT 5');
        console.log('Rows:');
        rows.forEach(r => console.log(`  ID: ${r.id}, personaInterna: ${r.personaInterna}, fechaHoraRegistro: ${r.fechaHoraRegistro}, idEstado: ${r.idEstado}`));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
