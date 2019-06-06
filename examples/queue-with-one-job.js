const JobQueue = require("../dist/index").default;
const { JobStackFullError, TimeoutError } = require("../dist/index");

const dummyFetch = () =>
  new Promise(resolve => {
    setTimeout(() => resolve("success"), 1000);
  });

const mockJob = () => {};
let cancelledJobs = 0;
let timedOutJobs = 0;

// Initialize the job queue
const queue = new JobQueue({});
const jobs = Array.from({ length: 2 }).map(() => mockJob);

jobs.forEach(async job => {
  const err = await queue.execute(job);
  if (err instanceof JobStackFullError) {
    cancelledJobs += 1;
  }

  if (err instanceof TimeoutError) {
    timedOutJobs += 1;
  }
});

queue.flush();

console.log(">>>>>>Timed out jobs", timedOutJobs);
console.log(">>>>>>Cancelled jobs", cancelledJobs);
