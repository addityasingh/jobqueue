import { Job, Stack } from "./stack";
import { EventEmitter } from "events";

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

interface StackOptions {
  maxConcurrency: number;
  timeout: number; // in ms
  maxJobs: number; // Not sure if this is needed together with maxConcurrency
}

//TODO: Check and update if this value is optimal for polling
const POLLER_INTERVAL = 10;

class DoneEventEmitter extends EventEmitter {}

class RequestEventEmitter extends EventEmitter {}

class ErrorEventEmitter extends EventEmitter {}

export class JobStack {
  private stack: Stack;
  private done: DoneEventEmitter;
  private request: RequestEventEmitter;
  private timer: NodeJS.Timer;

  constructor(private options: StackOptions = {} as StackOptions) {
    // TODO: The concurrency is not yet implemented. Implement using pool mechanism
    this.options.maxConcurrency = this.options.maxConcurrency || 1;
    this.options.maxJobs = this.options.maxJobs || 1;
    // TODO: find an optimal fallback for timeout
    this.options.timeout = this.options.timeout || 1000;
    this.done = new DoneEventEmitter();
    this.timer = null;

    this.stack = new Stack(this.options.maxJobs);
    this.run();
  }

  /**
   * Flush and stop the job processing
   */
  flush() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Queue a new job, waits for errors if any
   */
  async wait() {
    const job = this.newJob();
    this.request.emit("request", job);

    const errorChannel = new Promise(resolve => {
      //TODO: this may block if `error` is not emitted with null value
      job.notify.on("error", err => {
        resolve(err);
      });
    });

    return {
      done: () => {
        this.done.emit("done");
      },
      err: await errorChannel
    };
  }

  async execute(job: () => any): Promise<{} | Error> {
    const { done, err } = await this.wait();
    if (err != null) {
      job();
      done();
      return null;
    } else {
      return err;
    }
  }

  private run() {
    this.timer = setInterval(async () => {
      const oldest = this.stack.getBottom();
      let timeout = oldest.timeout;

      // Handle incoming requests
      this.request.on("request", (job: Job) => {
        if (this.stack.isFull()) {
          const oldest = this.stack.shift();
          oldest.notify.emit("error", new JobStackFullError("Job stack full"));
        }

        this.stack.push(job);
      });

      // Handle completion of jobs
      this.done.on("done", () => {
        if (!this.stack.isEmpty()) {
          const job = this.stack.pop();
          // Emit this event for clarity, but no listener is registered for this
          job.notify.emit("success");
        }
      });

      // Handle timeout and remove the oldest job with throwing timeout error
      let timer = setTimeout(() => {
        oldest.notify.emit("error", new TimeoutError("Job timed out"));
        this.stack.shift();
      }, timeout);
      timer.unref();
    }, POLLER_INTERVAL);

    this.timer.unref();
  }

  private newJob(): Job {
    return {
      notify: new ErrorEventEmitter(),
      timeout: this.options.timeout
    };
  }
}
