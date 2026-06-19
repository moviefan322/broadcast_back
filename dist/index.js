import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import * as mediasoup from "mediasoup";
// import { types as mediasoupTypes } from "mediasoup";
const app = new Hono();
app.get("/", (c) => {
    return c.text(process.env.MESSAGE || "ENV NOT WORKING");
});
const port = Number(process.env.PORT) || 3000;
const httpServer = serve({
    fetch: app.fetch,
    port,
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    },
});
io.on("connect", (socket) => {
    console.log("connected:", socket.id);
});
