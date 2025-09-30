// AWS Lambda entry point
import { handle } from 'hono/aws-lambda';
import { app } from './server';
export const handler = handle(app);
