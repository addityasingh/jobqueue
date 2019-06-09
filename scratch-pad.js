const { EventEmitter } = require("events");

// Provide a job structure in a way that
// you can call back the notify function asynchronously

// since timeout will be called at some point in future
// use a promise for the timed out value

const channel = new EventEmitter();

async function wait() {
  const job = {
    notify: err => {
      job.channel.emit("customerror", err);
    },
    channel: new EventEmitter()
  };

  const channelAsync = new Promise(resolve => {
    job.channel.on("customerror", err => {
      resolve(err);
    });
  });
  channel.emit("request", job);

  try {
    const res = await channelAsync;
    console.log(res.message);
  } catch (err) {
    console.log("error", err);
  }
}

function timeoutCaller() {
  channel.on("request", job => {
    job.notify(new Error("timed out"));
  });
}

timeoutCaller();
console.log(">>>>>>>.listener established");
wait();
