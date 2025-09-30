import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import { getPmtilesInstance } from './s3';

const app = new Hono();
app.get('/health', (c) => c.text('ok'));

app.get('/tiles/:id/metadata.json', async (c) => {
	const id = c.req.param('id');
	const pmtiles = await getPmtilesInstance(id);
	const metadata = await pmtiles.getMetadata();
	return c.json(metadata);
});

app.get('/tiles/:id/:z/:x/:y', async (c) => {
	const id = c.req.param('id');
	const z = Number(c.req.param('z'));
	const x = Number(c.req.param('x'));
	const y = Number(c.req.param('y'));

	const pmtiles = await getPmtilesInstance(id);
	const tile = await pmtiles.getZxy(z, x, y);

	if (tile === undefined) return c.text('tile not found', 404);

	return c.body(Buffer.from(tile.data), 200, {
		'Content-Type': 'application/vnd.mapbox-vector-tile',
	});
});

export { app };

serve({ fetch: app.fetch, port: 5500 });
