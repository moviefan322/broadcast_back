export class Room {
    roomName;
    worker;
    router;
    clients;
    producer = null;
    constructor(roomName, workerToUse) {
        this.roomName = roomName;
        this.worker = workerToUse;
        this.router = null;
        this.clients = [];
    }
    async createRouter() {
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
    addClient(client) {
        this.clients.push(client);
    }
    setProducer(newProducer) {
        if (this.producer && !this.producer.closed) {
            throw new Error("Room already has a producer");
        }
        this.producer = newProducer;
    }
    removeClient(socketId) {
        this.clients = this.clients.filter((client) => client.socket.id !== socketId);
    }
    closeRoom() {
        console.log("closing room:", this.roomName);
        for (const client of this.clients) {
            client.closeMedia();
            client.socket.leave(this.roomName);
        }
        if (this.producer && !this.producer.closed) {
            this.producer.close();
        }
        if (this.router && !this.router.closed) {
            this.router.close();
        }
        this.clients = [];
        this.producer = null;
        this.router = null;
    }
}
