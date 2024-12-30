require('dotenv').config();
const Document = require('./document');
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URL;
mongoose.connect(URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

const defaultValue = '';
let userCounter = 0;

const PORT = process.env.PORT || 3001;
const io = require('socket.io')(PORT, {
    cors: {
        origin: 'https://neodocs.netlify.app',
        methods: ['GET', 'POST'],
    },
});

console.log(`Server running on port ${PORT}`);

io.on('connection', (socket) => {
    const userNumber = ++userCounter;
    // console.log(`User connected: ${socket.id}, User Number: ${userNumber}`);

    socket.on('get-document', async (documentId) => {
        const document = await findOrCreateDocument(documentId);

        socket.join(documentId);

        const numberOfUsers = io.sockets.adapter.rooms.get(documentId).size;

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
            await Document.findByIdAndUpdate(documentId, { data: data });
        });
    });

    socket.on('disconnect', () => {
    });
});

async function findOrCreateDocument(id) {
    if (id == null) return;
    const document = await Document.findById({ _id: id });
    console.log(document);

    if (document) return document;

    return await Document.create({ _id: id, data: defaultValue });
}
