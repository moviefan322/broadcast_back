import type {
  WebRtcTransport,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  Producer,
  Consumer,
} from "mediasoup/types";
import type { Socket } from "socket.io";
import { Room } from "./Room.js";

const ANNOUNCED_ADDRESS =
  process.env.MEDIASOUP_ANNOUNCED_ADDRESS || "127.0.0.1";

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
    const transport = await this.room?.router?.createWebRtcTransport({
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      listenInfos: [
        {
          protocol: "udp",
          ip: "127.0.0.1",
        //   announcedAddress: ANNOUNCED_ADDRESS,
        },
        {
          protocol: "tcp",
          ip: "127.0.0.1",
        //   announcedAddress: ANNOUNCED_ADDRESS,
        },
      ],
    });
    
    const clientTransportParams: ClientTransportParams = {
      id: transport?.id || "",
      iceParameters: transport?.iceParameters || ({} as IceParameters),
      iceCandidates: transport?.iceCandidates || ([] as IceCandidate[]),
      dtlsParameters: transport?.dtlsParameters || ({} as DtlsParameters),
    };

    if (type === "producer") {
      // set new transport to this client's upstreamTransport
      this.upstreamTransport = transport as WebRtcTransport;
    } else if (type === "consumer") {
      // SET DOWNSTREAM TRANSPORT
      this.downstreamTransport = transport as WebRtcTransport;
    }

    return clientTransportParams;
  }

  addProducer(newProducer: Producer) {
    this.producer = newProducer;
  }
  addConsumer(newConsumer: Consumer) {
    this.consumer = newConsumer;
  }
}
