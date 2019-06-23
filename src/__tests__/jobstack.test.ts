import { JobStack, TimeoutError } from "../jobstack";
import { JobStackFullError } from "..";

describe("Job stack", () => {
  describe("with single concurrency", () => {
    test("create stack successfully with default options", async () => {
      const queue = new JobStack();
      const mockJob = jest.fn(() => Promise.resolve());
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
      const mockJob = jest.fn(() => Promise.resolve());
      const err = await queue.execute(mockJob);
      expect(err).toBeUndefined();
      expect(mockJob).toHaveBeenCalled();
    });

    test("queue and process single job", async () => {
      const queue = new JobStack();
      const mockJob = jest.fn(() => Promise.resolve("mocked response"));
      const response = await queue.execute(mockJob);
      expect(response).toBe("mocked response");
      expect(mockJob).toHaveBeenCalled();
    });

    test("queue and process multiple jobs within max limit", async () => {
      const queue = new JobStack({ maxJobs: 5 });
      const mockJob = jest.fn(() => Promise.resolve("mocked response"));
      await queue.execute(mockJob);
      await queue.execute(mockJob);
      await queue.execute(mockJob);
      await queue.execute(mockJob);

      expect(mockJob).toHaveBeenCalledTimes(4);
    });

    test("should log JobStackFullError when more jobs than max are sent", async () => {
      const mockLogger = jest.fn(() => {});
      const queue = new JobStack({ maxJobs: 1, logger: mockLogger });
      const mockAsyncJob = jest.fn(() => Promise.resolve());
      await queue.execute(mockAsyncJob);
      await queue.execute(mockAsyncJob);
      expect(mockLogger).toBeCalledWith(
        new JobStackFullError("Job stack full")
      );
    });

    test("queue and cancel jobs with timeout", async () => {
      expect.assertions(2);
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
      const error = await queue.execute(mockJobFail);
      if (error instanceof Error) {
        timedOutJobs += 1;
      }

      expect(mockJobFail).toHaveBeenCalled();
      expect(timedOutJobs).toBe(1);
    });

    test("should cancel the timeout job and add latest in queue", async () => {
      expect.assertions(5);
      const mockLogger = jest.fn(() => {});
      const queue = new JobStack({ maxJobs: 1, logger: mockLogger });
      const mockJob = jest.fn(() => Promise.resolve("mock response"));
      const mockAsyncJob = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve("mock failure response"), 500);
          })
      );
      const error = await queue.execute(mockAsyncJob);
      const response = await queue.execute(mockJob);
      expect(response).toBe("mock response");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Job timed out");
      expect(mockLogger).toBeCalledWith(
        new JobStackFullError("Job stack full")
      );
      expect(mockLogger).toBeCalledWith(new TimeoutError("Job timed out"));
    });
  });

  describe("with multiple concurrency", () => {
    test.todo("create stack with max concurrency successfully");
    test.todo("queue and process job in stack with multiple concurrency");
  });
});
