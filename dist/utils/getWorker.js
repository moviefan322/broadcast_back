export async function getWorker(workers) {
    if (workers.length === 0) {
        throw new Error("No mediasoup workers available");
    }
    const workersLoad = await Promise.all(workers.map(async (worker) => {
        const stats = await worker.getResourceUsage();
        // This is cumulative CPU usage, not live/current load
        const cpuUsage = stats.ru_utime + stats.ru_stime;
        return cpuUsage;
    }));
    let leastLoadedWorkerIndex = 0;
    let leastWorkerLoad = Number.POSITIVE_INFINITY;
    for (let i = 0; i < workersLoad.length; i++) {
        if (workersLoad[i] < leastWorkerLoad) {
            leastWorkerLoad = workersLoad[i];
            leastLoadedWorkerIndex = i;
        }
    }
    return workers[leastLoadedWorkerIndex];
}
