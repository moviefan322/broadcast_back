import "dotenv/config";

import type { Socket } from "socket.io";
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

io.on("connection", (socket: Socket) => {
  console.log("connected:", socket.id);

  socket.onAny((event, ...args) => {
    console.log("RTC socket event:", event, args);
  });

  // initialize client
  let client: Client;

  // handshake info
  // use later for authentication and authorization
  // const handshake = socket.handshake;
  // console.log("handshake:", handshake);

  socket.on("joinRoom", async ({ userName, roomName }, ack) => {
    console.log(`joinRoom request: userName=${userName}, roomName=${roomName}`);
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

    ack({
      ok: true,
      routerRtpCapabilities: client?.room?.router?.rtpCapabilities,
      newRoom,
      producerAvailable: !!client.room.producer,
    });
  });

  socket.on("requestTransport", async ({ type }, ack) => {
    // producers and consumers need params
    let clientTransportParams = null;
    if (type === "producer") {
      // run addTransport, part of our client class
      clientTransportParams = await client.addTransport(type);
    } else if (type === "consumer") {
      // run addTransport
      clientTransportParams = await client.addTransport(type);
      console.log(
        "server downstream transport:",
        client.downstreamTransport?.id,
      );
      console.log("sending params id:", clientTransportParams.id);
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
      await client.downstreamTransport?.connect({ dtlsParameters });
      ack({ ok: true });
      try {
      } catch (err) {
        console.log("Error connecting consumer transport:", err);
        ack({ ok: false, error: "Failed to connect consumer transport" });
      }
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
      const message = error instanceof Error ? error.message : String(error);

      console.log("Error starting producer:", message);

      ack({ ok: false, error: message });
    }
  });
  socket.on("consumeMedia", async ({ rtpCapabilities }, ack) => {
    // set up clientConsumer, send back params
    // use right transport, add/update consumer in client
    // confirm canConsume
    try {
      const producer = client?.room?.producer;
      if (!producer) {
        ack({ ok: false, error: "No producer in room" });
        return;
      }
      if (
        !client?.room?.router?.canConsume({
          producerId: producer.id,
          rtpCapabilities,
        })
      ) {
        ack({ ok: false, error: "Cannot consume" });
        return;
      } else {
        const newConsumer = await client.downstreamTransport?.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: true,
        });
        if (!newConsumer) {
          ack({ ok: false, error: "Failed to create consumer" });
          return;
        }
        console.log("server consumer created:", {
          id: newConsumer.id,
          paused: newConsumer.paused,
          producerId: producer.id,
        });
        client.addConsumer(newConsumer);
        const consumerParams = {
          producerId: producer.id,
          id: newConsumer.id,
          kind: newConsumer.kind,
          rtpParameters: newConsumer.rtpParameters,
        };
        ack({ ok: true, consumerParams });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.log("Error starting producer:", message);

      ack({ ok: false, error: message });
    }
  });
  socket.on("unpauseConsumer", async (ack) => {
    console.log("Received unpauseConsumer event");

    try {
      if (!client.consumer) {
        console.log("No server-side consumer found on client");
        ack({ ok: false, error: "No consumer to resume" });
        return;
      }

      console.log("before resume:", {
        id: client.consumer.id,
        paused: client.consumer.paused,
      });

      await client.consumer.resume();

      console.log("after resume:", {
        id: client.consumer.id,
        paused: client.consumer.paused,
      });

      ack({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.log("Error resuming consumer:", message);

      ack({ ok: false, error: message });
    }
  });
  socket.on("disconnect", (reason) => {
    console.log("socket disconnected:", socket.id, reason);

    if (!client) {
      console.log("disconnected socket had no client yet");
      return;
    }

    const room = client.room;

    if (!room) {
      client.closeMedia();
      return;
    }

    const wasBroadcaster =
      !!client.producer && room.producer?.id === client.producer.id;

    if (wasBroadcaster) {
      console.log("broadcaster disconnected, closing room:", room.roomName);

      socket.to(room.roomName).emit("roomClosed", {
        reason: "broadcaster-disconnected",
      });

      room.closeRoom();

      const roomIndex = rooms.findIndex((r) => r.roomName === room.roomName);

      if (roomIndex !== -1) {
        rooms.splice(roomIndex, 1);
      }

      console.log("room removed:", room.roomName);

      return;
    }

    console.log("non-broadcaster disconnected:", client.userName);

    client.closeMedia();
    room.removeClient(socket.id);
    socket.leave(room.roomName);

    if (room.clients.length === 0) {
      console.log("empty room, closing:", room.roomName);

      room.closeRoom();

      const roomIndex = rooms.findIndex((r) => r.roomName === room.roomName);

      if (roomIndex !== -1) {
        rooms.splice(roomIndex, 1);
      }
    }
  });
});
