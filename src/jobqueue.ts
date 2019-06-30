import { Job, Stack } from "./stack";
import debug from "debug";
const jobqueueDebug = debug("jobqueue");

const noop = () => {};
const JOB_QUEUE_FULL = "Job queue full";
const JOB_TIMED_OUT = "Job timed out";

export type InputJob = (() => Promise<any>) | (() => any);

export class JobTimeoutError extends Error {
  constructor() {
    super(JOB_TIMED_OUT);
    this.name = "JobTimeoutError";
  }
}

export class JobQueueFullError extends Error {
  constructor() {
    super(JOB_QUEUE_FULL);
    this.name = "JobQueueFullError";
  }
}

class JobImpl implements Job {
  timeout: number;
  index: number;
  timer: NodeJS.Timer;
  wait: () => Promise<any | Error>;

  constructor(timeout: number, index: number, job: InputJob) {
    this.timeout = timeout;
    this.index = index;
    this.timer = null;

    this.wait = (rejectReason: any = "") =>
      rejectReason ? Promise.reject(rejectReason) : job();
  }
}

interface QueueOptions {
  maxConcurrency?: number;
  timeout?: number; // in ms
  maxJobs?: number;
  logger?: (message?: any) => void;
}

export class JobQueue {
  private stack: Stack;

  constructor(private options: QueueOptions = {} as QueueOptions) {
    // TODO: The concurrency is not yet implemented. Implement using pool mechanism
    this.options.maxConcurrency = options.maxConcurrency || 1;
    this.options.maxJobs = options.maxJobs || 1;
    this.options.timeout = options.timeout || 100;
    this.options.logger = options.logger || noop;

    this.stack = new Stack(this.options.maxJobs);
  }

  private queue(job) {
    if (this.stack.isFull()) {
      jobqueueDebug("Job queue full");
      const oldestJob = this.stack.shift();
      this.stack.push(job);
      return oldestJob.wait(new JobQueueFullError());
    }
    return Promise.resolve();
  }

  execute(inputJob: InputJob): Promise<any | Error> {
    // if stack is full, throw JobQueueFullError
    // remove the first element in queue, and add the job
    // else create a new job for incoming job with
    // timeout handler, and done handler.
    // On timeout this job should let the stack remove it
    // On done (error or success), the job should let the stack remove it

    const index = this.stack.getLength();
    const job = new JobImpl(this.options.timeout, index, inputJob);

    return this.queue(job)
      .then(() => {
        this.stack.push(job);

        return Promise.race([
          job.wait(),
          new Promise((_, reject) => {
            job.timer = setTimeout(() => {
              const err = new JobTimeoutError();
              reject(err);
            }, this.options.timeout);
            job.timer.unref();
          })
        ])
          .catch(err => {
            this.options.logger(err);
            jobqueueDebug("Error in executing input job");

            if (job.timer != null) {
              clearTimeout(job.timer);
              job.timer = null;
            }

            this.stack.remove(job);
            // JobTimeoutError or actual error from the job execution
            return err;
          })
          .then(val => val);
      })
      .catch(err => {
        this.options.logger(err);
        // JobQueueFullError
        return err;
      });
  }
}
