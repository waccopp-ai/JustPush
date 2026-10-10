/**
 * Servidor de señalización para la app walkie-talkie.
 * Solo pasa mensajes de "handshake" WebRTC (offer/answer/ICE) entre
 * los usuarios de un mismo canal. El audio NUNCA pasa por aquí:
 * una vez conectados, viaja directo entre los dos dispositivos.
 *
 * Despliegue rápido (gratis): Railway, Render o Fly.io.
 *   1. npm install
 *   2. npm start
 *   3. Copia la URL pública que te dé el hosting (empieza con https://,
 *      pero en el cliente se usa como wss://) y pégala en el campo
 *      "Servidor de señalización" de walkie-talkie.html
 */

const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Servidor de señalización activo.\n");
});

const io = new Server(server, {
  cors: { origin: "*" }
});

// room -> Map(socketId -> name)
const rooms = new Map();

io.on("connection", (socket) => {
  let currentRoom = null;

  function leaveCurrentRoom() {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      socket.to(currentRoom).emit("peer-left", { id: socket.id });
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
      socket.leave(currentRoom);
    }
    currentRoom = null;
  }

  socket.on("join", ({ room, name }) => {
    // Si ya estaba en otro canal (cambio de canal), sal de ahí primero
    leaveCurrentRoom();

    currentRoom = room;
    socket.join(room);

    if (!rooms.has(room)) rooms.set(room, new Map());
    const members = rooms.get(room);

    // Informa al que entra quién ya estaba
    const existing = Array.from(members, ([id, n]) => ({ id, name: n }));
    socket.emit("existing-peers", existing);

    members.set(socket.id, name);

    // Informa a los demás que alguien nuevo entró
    socket.to(room).emit("peer-joined", { id: socket.id, name });
  });

  socket.on("leave", () => {
    leaveCurrentRoom();
  });

  socket.on("signal", ({ to, name, data }) => {
    io.to(to).emit("signal", { from: socket.id, name, data });
  });

  socket.on("talk-state", ({ room, talking }) => {
    socket.to(room).emit("talk-state", { id: socket.id, talking });
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom();
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de señalización escuchando en el puerto ${PORT}`);
});
