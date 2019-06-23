import { JobStack, TimeoutError } from "../jobstack";
import { JobStackFullError } from "..";

// jest.useFakeTimers();
describe("Timer", () => {
  test.todo(
    "should cancel the first job and add latest in queue when more jobs than max are sent"
  );

  test("job should forcefully timeout oldest jobs for a full queue", async () => {
    expect.assertions(6);
    const mockLogger = jest.fn(() => {});
    const queue = new JobStack({
      maxJobs: 1,
      timeout: 2000,
      logger: mockLogger
    });
    const mockAsyncJob1 = jest.fn(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve("mock failure response"), 500);
        })
    );
    const mockAsyncJob2 = jest.fn(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve("mock success response"), 600);
        })
    );
    const error = await queue.execute(mockAsyncJob1);
    // jest.runAllTimers();
    // jest.advanceTimersByTime(200);
    const error2 = await queue.execute(mockAsyncJob2);
    // jest.advanceTimersByTime(700);

    console.log("error", error);
    console.log("error2", error2);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Job timed out");

    expect(error2).toBe("mock success response");
    expect(error2).not.toBeInstanceOf(Error);
    expect(mockLogger).toHaveBeenNthCalledWith(
      1,
      new TimeoutError("Job timed out")
    );
    expect(mockLogger).toHaveBeenNthCalledWith(
      2,
      new JobStackFullError("Job stack full")
    );
  });
});
