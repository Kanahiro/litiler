import { handle } from 'hono/aws-lambda';
import { serve } from '@hono/node-server';

import { getApp } from './server';
const app = getApp(process.env);

export const handler = handle(app);

if (process.env.TITILER_USING_NODEJS === 'true') serve(app);
