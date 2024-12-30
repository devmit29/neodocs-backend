require('dotenv').config();
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Document = require('./document');

let io;
let initialized = false;

exports.handler = async (event, context) => {
    if (!initialized) {
        // Connect to MongoDB
        const URI = process.env.MONGODB_URL;
        mongoose.connect(URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => console.log('MongoDB connected'))
        .catch(err => console.error('MongoDB connection error:', err));

        // Initialize Socket.IO server
        io = new Server(3001, {
            cors: {
                origin: 'https://neodocs.netlify.app',
                methods: ['GET', 'POST'],
            },
        });

        setupSocketIO(io);

        initialized = true;
    }

    // Return a simple response for Netlify to confirm the function is running
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': 'https://neodocs.netlify.app',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: 'Socket.IO server is running.',
    };
};

function setupSocketIO(io) {
    const defaultValue = '';
    let userCounter = 0;

    io.on('connection', (socket) => {
        const userNumber = ++userCounter;

        socket.on('get-document', async (documentId) => {
            const document = await findOrCreateDocument(documentId);

            socket.join(documentId);

            const numberOfUsers = io.sockets.adapter.rooms.get(documentId)?.size || 0;

            socket.emit('load-document', document.data, numberOfUsers);

            socket.on('send-changes', (delta) => {
                socket.broadcast.to(documentId).emit('receive-changes', delta);
            });

            socket.on('update-cursor', (cursorData) => {
                socket.broadcast.to(documentId).emit('cursor-position', {
                    ...cursorData,
                    userNumber,
                });
            });

            socket.on('save-document', async (data) => {
                await Document.findByIdAndUpdate(documentId, { data });
            });
        });

        socket.on('disconnect', () => {});
    });

    async function findOrCreateDocument(id) {
        if (!id) return null;
        const document = await Document.findById(id);
        if (document) return document;
        return await Document.create({ _id: id, data: defaultValue });
    }
}
