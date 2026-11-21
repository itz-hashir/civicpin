import { MongoClient } from "mongodb";

let clientPromise = global._mongoClientPromise;

function connect() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      return Promise.reject(new Error("MONGODB_URI is not configured"));
    }
    clientPromise = new MongoClient(uri).connect();
    global._mongoClientPromise = clientPromise;
  }
  return clientPromise;
}

const lazyClient = {
  then(onFulfilled, onRejected) {
    return connect().then(onFulfilled, onRejected);
  },
  catch(onRejected) {
    return connect().catch(onRejected);
  },
  finally(onFinally) {
    return connect().finally(onFinally);
  },
};

export default lazyClient;
