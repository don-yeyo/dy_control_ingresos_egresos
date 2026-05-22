require('dotenv').config();
const PORT = process.env.PORT || 5001;

async function testApi() {
    try {
        const response = await fetch(`http://localhost:${PORT}/api/porteria/pendientes?email=gabrielt@donyeyo.com.ar`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error hitting local API:', err.message);
    }
}

testApi();
