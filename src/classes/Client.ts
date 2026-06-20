import type {
  WebRtcTransport,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  Producer,
  Consumer,
} from "mediasoup/types";
import type { Socket } from "socket.io";
import type { Room } from "./Room.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const MEDIASOUP_LISTEN_IP = IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1";

const MEDIASOUP_ANNOUNCED_ADDRESS = process.env.MEDIASOUP_ANNOUNCED_ADDRESS;

if (IS_PRODUCTION && !MEDIASOUP_ANNOUNCED_ADDRESS) {
  throw new Error("MEDIASOUP_ANNOUNCED_ADDRESS is required in production");
}

type ClientTransportParams = {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
};

type TransportType = "producer" | "consumer";

export class Client {
  userName: string;
  socket: Socket;
  room: Room | null = null;
  upstreamTransport: WebRtcTransport | null = null;
  downstreamTransport: WebRtcTransport | null = null;
  producer: Producer | null = null;
  consumer: Consumer | null = null;

  constructor(userName: string, socket: Socket) {
    this.userName = userName;
    this.socket = socket;
    this.room = null;
  }
  async addTransport(type: TransportType): Promise<ClientTransportParams> {
    if (!this.room?.router) {
      throw new Error(
        "Cannot create transport before client has joined a room",
      );
    }
    const transport = await this.room.router.createWebRtcTransport({
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      listenInfos: [
        {
          protocol: "udp",
          ip: MEDIASOUP_LISTEN_IP,
          announcedAddress: MEDIASOUP_ANNOUNCED_ADDRESS,
        },
        {
          protocol: "tcp",
          ip: MEDIASOUP_LISTEN_IP,
          announcedAddress: MEDIASOUP_ANNOUNCED_ADDRESS,
        },
      ],
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

    const clientTransportParams: ClientTransportParams = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };

    if (type === "producer") {
      this.upstreamTransport = transport;
    } else if (type === "consumer") {
      this.downstreamTransport = transport;
    }

    return clientTransportParams;
  }

  addProducer(newProducer: Producer) {
    this.producer = newProducer;
  }
  addConsumer(newConsumer: Consumer) {
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
