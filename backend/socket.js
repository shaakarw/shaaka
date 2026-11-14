let io = null;
let attachedServer = null;

module.exports = {
  init: (server) => {
    if (io) {
      if (attachedServer !== server) {
        throw new Error('Socket.IO has already been initialized for another HTTP server.');
      }
      return io;
    }

    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: { origin: '*' },
    });
    attachedServer = server;
    return io;
  },
  getIO: () => io,
};
