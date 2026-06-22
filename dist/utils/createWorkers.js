import os from "node:os";
import * as mediasoup from "mediasoup";
const RTC_MIN_PORT = Number(process.env.RTC_MIN_PORT ?? 40000);
const RTC_MAX_PORT = Number(process.env.RTC_MAX_PORT ?? 41000);
const totalThreads = os.cpus().length;
export const createWorkers = async () => {
    const workers = [];
    for (let i = 0; i < totalThreads; i++) {
        const worker = await mediasoup.createWorker({
            rtcMinPort: RTC_MIN_PORT,
            rtcMaxPort: RTC_MAX_PORT,
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
