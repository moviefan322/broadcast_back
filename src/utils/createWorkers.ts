import os from "os";
import * as mediasoup from "mediasoup";

const totalThreads = os.cpus().length;

export const createWorkers = () =>
  new Promise(async (resolve, reject) => {
    let workers = [];
    // loop to create workers based on number of threads
    for (let i = 0; i < totalThreads; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: 40000,
        rtcMaxPort: 41000,
        logLevel: "warn",
        logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      });
    //   console.log(`worker ${worker.pid} created`);
      worker.on("died", () => {
        // this should never happen
        console.log("mediasoup worker has died");
        process.exit(1); // kill node program
      });
      workers.push(worker);
    }

    resolve(workers);
  });
