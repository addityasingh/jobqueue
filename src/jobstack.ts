import { Job, Stack, ErrorType } from "./stack";
import { EventEmitter } from "events";

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

interface WaitResponse {
  done: () => any;
  error: Error;
}

class JobImpl implements Job {
  channel: ChannelEmitter;
  timeout: number;

  constructor(timeout: number) {
    this.channel = new ChannelEmitter();
    this.timeout = timeout;
  }

  notify(error: Error, type: ErrorType = ErrorType.CustomError) {
    console.log(">>>>>>>>>inside notify", error);
    console.log(">>>>>>>>>[ErrorType]: inside notify ", type);

    this.channel.emit(type, error);
  }
}

interface StackOptions {
  maxConcurrency?: number;
  timeout?: number; // in ms
  maxJobs?: number; // Not sure if this is needed together with maxConcurrency
}

class ChannelEmitter extends EventEmitter {}

export class JobStack {
  private stack: Stack;
  private timer: NodeJS.Timer;
  private channel: ChannelEmitter;

  constructor(private options: StackOptions = {} as StackOptions) {
    // TODO: The concurrency is not yet implemented. Implement using pool mechanism
    this.options.maxConcurrency = this.options.maxConcurrency || 1;
    this.options.maxJobs = this.options.maxJobs || 1;
    this.options.timeout = this.options.timeout || 100;

    this.channel = new ChannelEmitter();
    this.channel.setMaxListeners(100);
    this.timer = null;
    this.stack = new Stack(this.options.maxJobs);
    this.run();
  }

  private run() {}

  async execute(job: InputJob): Promise<Error> {
    console.log(">>>>>>>>>>stack isFull()", this.stack.isFull());
    const { done, error } = await this.wait(job);
    if (error != null) {
      return error;
    } else {
      await job(); //<-----------------Here is the problem
      done();
      return null;
    }
  }

  /**
   * Queue a new job, waits for errors if any
   */
  wait(inputJob?: any): Promise<WaitResponse> {
    const job: JobImpl = new JobImpl(this.options.timeout);

    const errorHandler = new Promise((_, reject) => {
      job.channel.on("customerror", err => {
        console.error(
          ">>>>>>>[customerror] handler should not be called. error is",
          err
        );
        reject(err);
      });
    });

    const timeoutHandler = new Promise((_, reject) => {
      job.channel.on("timeouterror", err => {
        console.error(
          ">>>>>>>[timeouterror] handler should not be called. error is",
          err
        );
        reject(err);
      });
    });

    // Handle timeout and remove the oldest job with throwing timeout error
    let timer = setTimeout(() => {
      const oldest = this.stack.getBottom();
      if (oldest != null) {
        console.error(">>>>>>>timeout fired");
        oldest.notify(
          new TimeoutError("Job timed out"),
          ErrorType.TimeoutError
        );
        this.stack.shift();
      }
    }, this.options.timeout);
    timer.unref();

    const channelAsync = Promise.race([errorHandler, timeoutHandler])
      .catch(err => {
        console.log("the winner among errors is", err);
        clearTimeout(timer);
        job.channel.removeListener(ErrorType.CustomError, () => {});
        job.channel.removeListener(ErrorType.TimeoutError, () => {});
        return err;
      })
      .then(error => {
        return {
          done: () => this.onDone(),
          error
        };
      });

    this.onRequest(job, inputJob);

    return channelAsync as Promise<WaitResponse>;
  }

  /**
   * Handle incoming requests
   * @param job Incoming job request
   */
  private onRequest(job: Job, inputJob?: any) {
    console.log(">>>>>>>>>>>request for job", inputJob);
    if (this.stack.isFull()) {
      const oldest = this.stack.shift();
      if (oldest != null) {
        oldest.notify(new JobStackFullError("Job stack full"));
      }
    }

    this.stack.push(job);
    job.notify(null);
  }

  private onDone() {
    if (!this.stack.isEmpty()) {
      this.stack.pop();
      // Emit this event for clarity
      // job.notify(null);
    }
  }

  /**
   * Flush and stop the job processing
   */
  flush() {
    this.channel.removeAllListeners();
    clearInterval(this.timer);
    this.timer = null;
  }
}
