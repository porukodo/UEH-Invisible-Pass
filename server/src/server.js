import { createApp } from './app.js';
import { env } from './config/env.js';
import { startTopupRetryJob } from './jobs/topupRetryJob.js';

const app = createApp();

startTopupRetryJob();

app.listen(env.port, () => {
  console.log(`UEH Invisible Pass API listening on port ${env.port}`);
});
