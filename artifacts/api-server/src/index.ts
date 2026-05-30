import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function startWithRetry(attemptsLeft: number) {
  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 1) {
      logger.warn({ port, attemptsLeft }, "Port in use, retrying in 3s...");
      setTimeout(() => startWithRetry(attemptsLeft - 1), 3000);
    } else {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
  });
}

startWithRetry(10);
