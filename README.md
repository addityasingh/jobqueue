# JobQueue

A LIFO([Last-In-First-Out](<https://en.wikipedia.org/wiki/Stack_(abstract_data_type)>)) job queue to provide back pressure and load shedding, while executing a queue of jobs

## Usage

```
npm install --save jobqueue
```

or with `yarn` as

```
yarn add jobqueue
```

## API

### jobqueue = new JobQueue([options])

- `options`:
  - `maxConcurrency: number` The number of concurrent jobs to execute at a time
  - `timeout: number` the time after which the job should be cancelled and removed from the queue
  - `maxJobs: number` the max number of jobs to be added to the queue for processing

#### `jobqueue.execute()`

Execute the set of jobs in the `JobQueue`

#### `jobqueue.flush()`

Flush all the jobs and close the job queue

#### `jobqueue.wait()`

Wait for the job to be executed, based on the consurrency of the JobQueue

## Basic Example

```javascript
const JobQueue = require("../dist/index").default;
const { JobStackFullError, TimeoutError } = require("../dist/index");

const dummyFetch = () =>
  new Promise(resolve => {
    setTimeout(() => resolve("success"), 1000);
  });
let cancelledJobs = 0;
let timedOutJobs = 0;

// Initialize the job queue
const queue = new JobQueue({});
const jobs = Array.from({ length: 2 }).map(() => dummyFetch);

jobs.forEach(async job => {
  const err = await queue.execute(job);
  if (err instanceof JobStackFullError) {
    cancelledJobs += 1;
  }

  if (err instanceof TimeoutError) {
    timedOutJobs += 1;
  }
});

queue.flush();

console.log(">>>>>>Timed out jobs", timedOutJobs);
console.log(">>>>>>Cancelled jobs", cancelledJobs);
```

For more examples refer the [examples](/examples) folder. To run the examples:

```
yarn build && node examples/queue-with-one-job.js
```

#### Credits

This is inspired by [Dropbox's Bandaid proxy](https://blogs.dropbox.com/tech/2018/03/meet-bandaid-the-dropbox-service-proxy/). Thanks a lot to [Arpad](https://github.com/aryszka) for the `Golang` implementation of [JobQueue](https://github.com/aryszka/jobqueue) was helpful in implementing this for JavaScript
