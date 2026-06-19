import "dotenv/config";

import type { Worker } from "mediasoup/types";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import * as mediasoup from "mediasoup";

import { createWorkers } from "./utils/createWorkers.js";
import { getWorker } from "./utils/getWorker.js";

import { Room } from "./classes/Room.js";
import { Client } from "./classes/Client.js";

const app = new Hono();

app.get("/", (c) => {
  return c.text(process.env.MESSAGE || "ENV NOT WORKING");
});

const port = Number(process.env.PORT) || 3000;

const httpServer = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

let workers: Worker[] | null = null;
const rooms: Room[] = [];

const initMediaSoup = async () => {
  workers = await createWorkers();
};

initMediaSoup();

io.on("connect", (socket) => {
  console.log("connected:", socket.id);

  // initialize client
  let client: Client;

  // handshake info
  // use later for authentication and authorization
  // const handshake = socket.handshake;
  // console.log("handshake:", handshake);

  socket.on("joinRoom", async ({ userName, roomName }, ack) => {
    let newRoom = false;
    client = new Client(userName, socket);
    // check if room exists
    let requestedRoom = rooms.find((room) => room.roomName === roomName);
    // if no room, create one
    if (!requestedRoom) {
      newRoom = true;
      // make new room, add worker, add router
      if (!workers) {
        ack({ ok: false, error: "no workers" });
        return;
      }
      const workerToUse = await getWorker(workers);
      requestedRoom = new Room(roomName, workerToUse);
      await requestedRoom.createRouter();
      rooms.push(requestedRoom);
    }
    // add room to client
    client.room = requestedRoom;
    // add client to room clients
    client.room.addClient(client);
    // add this socket to the socket room
    socket.join(client.room.roomName);

    // what we want to pass for now:
    ack({
      ok: true,
      routerRtpCapabilities: client?.room?.router?.rtpCapabilities,
      newRoom,
    });
  });

  socket.on("requestTransport", async ({ type }, ack) => {
    // producers and consumers need params
    let clientTransportParams = null;
    if (type === "producer") {
      // run addTransport, part of our client class
      clientTransportParams = await client.addTransport(type);
    } else if (type === "consumer") {
    }
    ack({ ok: true, paramsFromServer: clientTransportParams });
  });

  socket.on("connectTransport", async ({ dtlsParameters, type }, ack) => {
    if (type === "producer") {
      try {
        await client.upstreamTransport?.connect({ dtlsParameters });
        ack({ ok: true });
      } catch (error) {
        console.error("Error connecting transport:", error);
        ack({ ok: false, error: "Failed to connect transport" });
      }
    } else if (type === "consumer") {
      // do consumer part!
    }
  });

  socket.on("startProducing", async ({ rtpParameters }, ack) => {
    // create a producer with rtp paramters
    try {
      if (!client.room) {
        ack({ ok: false, error: "Client is not in a room" });
        return;
      }

      if (!client.upstreamTransport) {
        ack({ ok: false, error: "No upstream transport" });
        return;
      }
      const newProducer = await client.upstreamTransport?.produce({
        rtpParameters,
        kind: "audio",
      });
      if (!newProducer) {
        ack({ ok: false, error: "Failed to create producer" });
        return;
      }
      client.addProducer(newProducer);
      client?.room?.setProducer(newProducer);
      ack({ ok: true, producerId: newProducer?.id });
    } catch (error) {
      console.log("Error starting producer:", error);
      ack({ ok: false, error });
    }
  });
});
