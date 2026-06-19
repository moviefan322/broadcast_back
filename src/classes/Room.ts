import type { Worker, Router, Producer } from "mediasoup/types";
import { Client } from "./Client.js";

export class Room {
  roomName: string;
  worker: Worker;
  router: Router | null;
  clients: Client[];
  producer: Producer | null = null;
  constructor(roomName: string, workerToUse: Worker) {
    this.roomName = roomName;
    this.worker = workerToUse;
    this.router = null;
    this.clients = [];
  }
  async createRouter(): Promise<void> {
    this.router = await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
      ],
    });
  }
  addClient(client: Client) {
    this.clients.push(client);
  }
  setProducer(newProducer: Producer) {
    if (this.producer && !this.producer.closed) {
      throw new Error("Room already has a producer");
    }

    this.producer = newProducer;
  }
}
