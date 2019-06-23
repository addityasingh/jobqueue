import { Job, Stack } from "./stack";

export type InputJob = (() => Promise<any>) | (() => any);

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
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

  constructor(timeout: number, index: number, job: () => Promise<any>) {
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
  maxJobs?: number; // Not sure if this is needed together with maxConcurrency
  logger?: (message?: any) => void;
}

export class JobStack {
  private stack: Stack;

  constructor(private options: StackOptions = {} as StackOptions) {
    // TODO: The concurrency is not yet implemented. Implement using pool mechanism
    this.options.maxConcurrency = options.maxConcurrency || 1;
    this.options.maxJobs = options.maxJobs || 1;
    this.options.timeout = options.timeout || 100;
    this.options.logger = options.logger || console.log;

    this.stack = new Stack(this.options.maxJobs);
  }

  execute(inputJob: InputJob): Promise<any | Error> {
    // if stack is full, throw JobStackFullError
    // remove the first element in queue, and add the job
    // else create a new job for incoming job with
    // timeout handler, and done handler
    // on timeout this job should let the stack remove it
    // on done (error or success), the job should let the stack remove it

    const index = this.stack.getLength();
    const job = new JobImpl(this.options.timeout, index, inputJob);

    // Sync operation: Check for JobStackFull and add job at top. No need to throw error
    // Async operation: Execute job in parallel with timeout promise. Throw Timeout error
    if (this.stack.isFull()) {
      const oldestJob = this.stack.shift();
      this.options.logger(new JobStackFullError("Job stack full"));
      // oldestJob.wait(true, new Error("Job stack full"));
    }
    this.stack.push(job);

    //TODO: The most important and only part now missing is
    // to notify(reject) the correct promise in case of Timeout or JobStackFull errors
    // individually
    return Promise.race([
      job.wait(),
      new Promise(resolve => {
        //TODO: Just log the error for now and return the Timeout later to fix it
        job.timer = setTimeout(() => {
          const err = new TimeoutError("Job timed out");
          this.options.logger(err);
          resolve(err);
        }, this.options.timeout);
        job.timer.unref();
      })
    ])
      .then(val => {
        if (job.timer != null) {
          clearTimeout(job.timer);
        }

        //TODO: Find better alternative for testing the error constructors
        if (val instanceof TimeoutError) {
          this.stack.remove(job);
        }
        return val;
      })
      .catch(err => {
        this.stack.remove(job);
        throw err;
      });
  }
}
