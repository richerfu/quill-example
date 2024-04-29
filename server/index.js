const Koa = require("koa");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = new Koa();

const httpServer = createServer(app.callback());
const io = new Server(httpServer,{
    cors: {
        origin: '*',
    }
});

io.on('connection', socket => {
    socket.on('update-snapshot', (data) => {
        console.log(data);
        io.emit('update-snapshot', data);
    })
})

httpServer.listen(3000);
