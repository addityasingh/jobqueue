import { JobStack, TimeoutError } from "../jobstack";

describe("Job stack", () => {
  describe("with single concurrency", () => {
    test("create stack successfully with default options", async () => {
      const queue = new JobStack();
      const mockJob = jest.fn(() => {});
      const err = await queue.execute(mockJob);
      expect(err).toBeUndefined();
      expect(mockJob).toHaveBeenCalled();
    });

    test("create stack successfully with provided options", async () => {
      const queue = new JobStack({
        maxConcurrency: 1,
        timeout: 500,
        maxJobs: 1
      });
      const mockJob = jest.fn(() => {});
      const err = await queue.execute(mockJob);
      expect(err).toBeUndefined();
      expect(mockJob).toHaveBeenCalled();
    });

    test("queue and process single job", async () => {
      const queue = new JobStack();
      const mockJob = jest.fn(() => {});
      const error = await queue.execute(mockJob);
      expect(error).toBeUndefined();
      expect(mockJob).toHaveBeenCalled();
    });

    test("queue and process multiple jobs within max limit", async () => {
      const queue = new JobStack({ maxJobs: 5 });
      const mockJob = jest.fn(() => {});
      await queue.execute(mockJob);
      await queue.execute(mockJob);
      await queue.execute(mockJob);
      await queue.execute(mockJob);

      expect(mockJob).toHaveBeenCalledTimes(4);
    });

    test("wait works as expected", async () => {
      const queue = new JobStack();

      expect.assertions(1);
      const { error } = await queue.wait();
      expect(error).toBeNull();
    });

    test("both sync and async jobs can be executed", async () => {
      const queue = new JobStack();
      const mockSyncJob = jest.fn(() => {});
      const mockAsyncJob = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve("loads of queue"), 500);
          })
      );

      expect.assertions(2);
      const executionError = await queue.execute(mockSyncJob);
      expect(executionError).toBeNull();

      const timedOutError = await queue.execute(mockAsyncJob);
      expect(timedOutError).toBeNull();
    });

    test.only("job should forcefully timeout only for a full queue", async () => {
      const queue = new JobStack({ maxJobs: 1, timeout: 50 });
      const mockSyncJob = () => {};
      const mockAsyncJob = () =>
        new Promise(resolve => {
          setTimeout(() => resolve("loads of queue"), 500);
        });

      expect.assertions(1);

      queue.execute(mockAsyncJob);
      const timedOutError = await queue.execute(mockSyncJob);

      // There are currently 2 problems.
      // 1. Why is list reset after second execute() call
      // 2. Why is the test run completed before the second execute() call
      expect(timedOutError).not.toBeNull();
    });

    test.todo("queue and cancel jobs more than max limit");

    test.todo("queue and cancel some jobs which timeout");

    test("queue and cancel jobs with timeout", async () => {
      jest.useFakeTimers();
      const queue = new JobStack({ timeout: 500, maxJobs: 1 });
      let timedOutJobs = 0;
      const mockJobFail = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve();
            }, 600);
          })
      );
      // const mockJobFail = jest.fn(() => {})
      await queue.execute(mockJobFail);

      let error;
      try {
        error = await queue.execute(mockJobFail);
      } catch (err) {
        error = err;
      }
      expect(mockJobFail).toHaveBeenCalled();
      if (error != null) {
        timedOutJobs += 1;
      }

      expect(timedOutJobs).toBe(1);
      jest.useRealTimers();
    });

    test.todo("queue and cancel jobs when stack full");
  });

  describe("with multiple concurrency", () => {
    test.todo("create stack with max concurrency successfully");
    test.todo("queue and process job in stack with multiple concurrency");
  });
});
