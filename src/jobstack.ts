import { Job, Stack } from "./stack";

export type InputJob = (() => Promise<any>) | (() => any);

export class JobTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobTimeoutError";
  }
}

export class JobStackFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobStackFullError";
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

    this.wait = (forceReject?: boolean, rejectReason: any = "") =>
      new Promise((resolve, reject) => {
        if (forceReject) {
          reject(rejectReason);
        } else {
          job()
            .then(resolve)
            .catch(reject);
        }
      });
  }
}

interface StackOptions {
  maxConcurrency?: number;
  timeout?: number; // in ms
  maxJobs?: number;
  logger?: (message?: any) => void;
}

const noop = () => {};

export class JobStack {
  private stack: Stack;

  constructor(private options: StackOptions = {} as StackOptions) {
    // TODO: The concurrency is not yet implemented. Implement using pool mechanism
    this.options.maxConcurrency = options.maxConcurrency || 1;
    this.options.maxJobs = options.maxJobs || 1;
    this.options.timeout = options.timeout || 100;
    this.options.logger = options.logger || noop;

    this.stack = new Stack(this.options.maxJobs);
  }

  private async queue(job) {
    if (this.stack.isFull()) {
      const oldestJob = this.stack.shift();
      this.stack.push(job);
      return oldestJob.wait(true, new JobStackFullError("Job stack full"));
    }
    return Promise.resolve(null);
  }

  execute(inputJob: InputJob): Promise<any | Error> {
    // if stack is full, throw JobStackFullError
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
              const err = new JobTimeoutError("Job timed out");
              this.options.logger(err);
              reject(err);
            }, this.options.timeout);
            job.timer.unref();
          })
        ])
          .catch(err => {
            if (job.timer != null) {
              clearTimeout(job.timer);
              job.timer = null;
            }
            this.stack.remove(job);
            // JobTimeoutError
            return err;
          })
          .then(val => val);
      })
      .catch(err => {
        this.options.logger(err);
        // JobStackFullError
        return err;
      });
  }
}
