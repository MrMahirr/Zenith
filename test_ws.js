const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", { transports: ["websocket"] });

socket.on("connect", () => {
  console.log("Connected to backend");
  
  socket.emit("led_manual", { color: "#FF0000", brightness: 255 });
  console.log("Emitted led_manual");
  
  socket.on("led_state_sync", (state) => {
    console.log("Received state:", state);
    process.exit(0);
  });

  setTimeout(() => {
    console.log("Timeout waiting for response");
    process.exit(1);
  }, 2000);
});
