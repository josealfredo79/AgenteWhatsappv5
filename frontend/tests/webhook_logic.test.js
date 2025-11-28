
// Mock logic to test the slicing fix
const historial = [
    { direccion: 'inbound', mensaje: 'Hola' },
    { direccion: 'outbound', mensaje: 'Hola, ¿en qué puedo ayudarte?' },
    { direccion: 'inbound', mensaje: 'Busco casa' },
    { direccion: 'outbound', mensaje: '¿En qué zona?' },
    { direccion: 'inbound', mensaje: 'En el centro' },
    { direccion: 'outbound', mensaje: '¿Presupuesto?' },
    { direccion: 'inbound', mensaje: '2 millones' },
    { direccion: 'outbound', mensaje: 'Entendido.' },
    { direccion: 'inbound', mensaje: 'Gracias' }
];

// Logic from the fixed handler
let messages = [];

if (historial.length > 0) {
    // Tomamos los últimos 10 mensajes para dar buen contexto
    // Aseguramos que estén en orden cronológico
    historial.forEach(msg => {
        const role = msg.direccion === 'inbound' ? 'user' : 'assistant';
        const contenido = msg.mensaje; // Mock cleaning
        if (contenido) {
            messages.push({ role, content: contenido });
        }
    });
}

console.log('Total messages:', messages.length);
console.log('Last message:', messages[messages.length - 1]);

if (messages.length === 9 && messages[messages.length - 1].content === 'Gracias') {
    console.log('TEST PASSED: All messages included.');
} else {
    console.error('TEST FAILED: Messages missing or incorrect.');
    process.exit(1);
}
