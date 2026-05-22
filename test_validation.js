const payload = {
    "movement": {
        "idTipo": "1",
        "personaInterna": "1542",
        "fechaHoraRegistro": "2026-03-02",
        "idLugarOrigen": "1",
        "idLugarDestino": 3,
        "motivo": "Requerimiento laboral",
        "personaAutorizante": "",
        "observacion": "",
        "destinoDetalle": "aaaaaa",
        "conRegreso": false,
        "usuario_app": "gabrielt@donyeyo.com.ar"
    },
    "articles": [
        {
            "descripcion": "a1",
            "cantidad": 1,
            "idEstado": 1,
            "conRetorno": true,
            "presentacion": "Bulto(s)",
            "idLugarDestino": 3,
            "destinatario": "bbbbb",
            "sinRetorno": false
        },
        {
            "descripcion": "a2",
            "cantidad": 1,
            "idEstado": 1,
            "conRetorno": true,
            "presentacion": "Bulto(s)",
            "idLugarDestino": 1,
            "destinatario": "",
            "sinRetorno": false
        }
    ],
    "documents": [
        {
            "tipo": "Remito",
            "descripcion": "d1",
            "cantidad": 1,
            "conRetorno": true,
            "idLugarDestino": 3,
            "destinatario": "ccccccc",
            "sinRetorno": false
        },
        {
            "tipo": "Remito",
            "descripcion": "d2",
            "cantidad": 1,
            "conRetorno": true,
            "idLugarDestino": 1,
            "destinatario": "",
            "sinRetorno": false
        }
    ]
};

require('dotenv').config({ path: './server/.env' });
const PORT = process.env.PORT || 5001;

async function testValidation() {
    try {
        console.log('Enviando payload de prueba al servidor...');
        const response = await fetch(`http://localhost:${PORT}/api/movements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            console.log('Respuesta del servidor (éxito):', data);
        } else {
            console.log('Respuesta del servidor (error):', response.status, JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log('Error de conexión:', error.message);
    }
}

testValidation();
