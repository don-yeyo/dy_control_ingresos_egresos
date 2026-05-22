require('dotenv').config();
const PORT = process.env.PORT || 5001;

async function testApi() {
    try {
        const response = await fetch(`http://localhost:${PORT}/api/porteria/pendientes?email=gabrielt@donyeyo.com.ar`);
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Total movements:', data.length);
        console.log('Movement IDs:', data.map(m => m.id));
        if (data.error) console.log('Error from API:', data.error);
    } catch (err) {
        console.error('Error hitting local API:', err.message);
    }
}

testApi();
