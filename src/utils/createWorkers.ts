import os from "node:os";
import * as mediasoup from "mediasoup";
import type { Worker } from "mediasoup/types";

const totalThreads = os.cpus().length;

export const createWorkers = async (): Promise<Worker[]> => {
  const workers: Worker[] = [];

  for (let i = 0; i < totalThreads; i++) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 41000,
      logLevel: "warn",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    });

    worker.on("died", () => {
      console.log("mediasoup worker has died");
      process.exit(1);
    });

    workers.push(worker);
  }

  return workers;
};
