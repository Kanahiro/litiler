import { serve } from '@hono/node-server';
import { handle } from 'hono/aws-lambda';

import { initS3 } from './s3';
import { app } from './server';

initS3(process.env);

export const handler = handle(app);

if (process.env.DEVELOP === '1') {
    serve(app);
}
