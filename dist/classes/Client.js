const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MEDIASOUP_ANNOUNCED_ADDRESS = IS_PRODUCTION
    ? process.env.MEDIASOUP_ANNOUNCED_ADDRESS
    : undefined;
if (IS_PRODUCTION && !MEDIASOUP_ANNOUNCED_ADDRESS) {
    throw new Error("MEDIASOUP_ANNOUNCED_ADDRESS is required in production");
}
const MEDIASOUP_LISTEN_IP = IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1";
function buildListenInfo(protocol) {
    return {
        protocol,
        ip: MEDIASOUP_LISTEN_IP,
        ...(MEDIASOUP_ANNOUNCED_ADDRESS
            ? { announcedAddress: MEDIASOUP_ANNOUNCED_ADDRESS }
            : {}),
    };
}
export class Client {
    userName;
    socket;
    room = null;
    upstreamTransport = null;
    downstreamTransport = null;
    producer = null;
    consumer = null;
    constructor(userName, socket) {
        this.userName = userName;
        this.socket = socket;
        this.room = null;
    }
    async addTransport(type) {
        if (!this.room?.router) {
            throw new Error("Cannot create transport before client has joined a room");
        }
        const transport = await this.room.router.createWebRtcTransport({
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            listenInfos: [buildListenInfo("udp"), buildListenInfo("tcp")],
        });
        transport.on("icestatechange", (state) => {
            console.log(`${type} server ICE state:`, state);
        });
        transport.on("dtlsstatechange", (state) => {
            console.log(`${type} server DTLS state:`, state);
        });
        transport.on("@close", () => {
            console.log(`${type} server transport closed`);
        });
        const clientTransportParams = {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        };
        if (type === "producer") {
            this.upstreamTransport = transport;
        }
        else if (type === "consumer") {
            this.downstreamTransport = transport;
        }
        return clientTransportParams;
    }
    addProducer(newProducer) {
        this.producer = newProducer;
    }
    addConsumer(newConsumer) {
        this.consumer = newConsumer;
    }
    closeMedia() {
        console.log("closing media for client:", this.userName);
        if (this.consumer && !this.consumer.closed) {
            this.consumer.close();
        }
        if (this.producer && !this.producer.closed) {
            this.producer.close();
        }
        if (this.downstreamTransport && !this.downstreamTransport.closed) {
            this.downstreamTransport.close();
        }
        if (this.upstreamTransport && !this.upstreamTransport.closed) {
            this.upstreamTransport.close();
        }
        this.consumer = null;
        this.producer = null;
        this.downstreamTransport = null;
        this.upstreamTransport = null;
    }
}
