export interface Job {
  timeout: number;
  index: number;
  timer: NodeJS.Timer;
  wait: (forceReject?: boolean, rejectReason?: any) => Promise<any | Error>;
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

  getLength() {
    return this.list.length;
  }

  /**
   * Push at top of job stack
   */

  push(job: Job) {
    this.list.push(job);
  }

  /**
   * Remove specific job
   * @param job
   */
  remove(job: Job) {
    const index = this.list.findIndex(l => l.index === job.index);
    this.list.splice(index, 1);
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
