import { EventEmitter } from "events";

export enum ErrorType {
  CustomError = "customerror",
  TimeoutError = "timeouterror"
}

export interface Job {
  timeout: number;
  channel: EventEmitter;
  notify: (error?: any, type?: ErrorType) => any;
}

export class Stack {
  private list: Array<Job> = [];

  constructor(private capacity: number) {}

  isEmpty() {
    return this.list.length === 0;
  }

  isFull() {
    return this.capacity > 0 && this.list.length === this.capacity;
  }

  /**
   * Push at top of job stack
   */

  push(job: Job) {
    this.list.push(job);
    console.log(">>>>>>>job pushed in stack", job, this.list);
  }

  /**
   * Get last element from bottom of stack
   */
  getBottom(): Job {
    console.log(">>>>>>>getBottom job in stack", this.list.length, this.list);
    return this.list[this.list.length - 1];
  }

  /**
   * Remove specific job
   * @param job
   */
  remove(job: Job) {
    //TODO
  }

  /**
   * Pop the first job (from top of stack)
   */
  pop(): Job {
    return this.list.shift();
  }

  /**
   * Remove the last job (from bottom of the stack)
   */
  shift(): Job {
    return this.list.pop();
  }
}
