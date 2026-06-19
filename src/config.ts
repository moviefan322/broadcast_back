const ANNOUNCED_ADDRESS =
  process.env.MEDIASOUP_ANNOUNCED_ADDRESS || "127.0.0.1";

export const config = {
  port: 3030,
  workerSettings: {
    rtcMinPort: 40000,
    rtcMaxPort: 41000,
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  routerMediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
  ],
  listenIps: [
    {
      protocol: "udp",
      ip: "0.0.0.0",
      announcedAddress: ANNOUNCED_ADDRESS,
    },
    {
      protocol: "tcp",
      ip: "0.0.0.0",
      announcedAddress: ANNOUNCED_ADDRESS,
    },
  ],
};
