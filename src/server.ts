import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import { PMTiles } from 'pmtiles';
import type { LayerSpecification } from 'maplibre-gl';

import { getPresignedUrl, listObjects } from './s3';

const app = new Hono();

const pmtiles_cache: Record<string, PMTiles> = {};

async function getPmtilesInstance(id: string) {
    if (pmtiles_cache[id]) return pmtiles_cache[id];

    const url = await getPresignedUrl(id);
    const pmtiles = new PMTiles(url);
    pmtiles_cache[id] = pmtiles;
    return pmtiles;
}

app.get('/health', (c) => c.text('ok'));

app.get('/', async (c) => {
    const data = await listObjects();
    return c.html(`<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <title>litiler</title>
        </head>
        <body>${data
            .map((id) => `<a href="/tiles/${id}">${id}</a><br/>`)
            .join('')}
        </body>
    </html>`);
});

app.get('/tiles', async (c) => {
    const data = await listObjects();
    return c.json(data);
});

app.get('/tiles/:id', async (c) => {
    // HTML
    const id = c.req.param('id');
    const pmtiles = await getPmtilesInstance(id);
    const metadata = (await pmtiles.getMetadata()) as any;

    const zoomlevels: {
        [layerId: string]: { maxzoom: number; minzoom: number };
    } = {};
    let minzoom = 24;
    let maxzoom = 0;
    metadata.vector_layers.forEach((layer: any) => {
        zoomlevels[layer.id] = {
            maxzoom: layer.maxzoom,
            minzoom: layer.minzoom,
        };
        if (layer.minzoom < minzoom) minzoom = layer.minzoom;
        if (layer.maxzoom > maxzoom) maxzoom = layer.maxzoom;
    });

    const vectorLayers = metadata.tilestats.layers as {
        layer: string;
        geometry: 'Point' | 'LineString' | 'Polygon';
    }[];

    const layers: LayerSpecification[] = vectorLayers.map((layer) => {
        const layertype = {
            Point: 'circle',
            LineString: 'line',
            Polygon: 'fill',
        }[layer.geometry] as 'circle' | 'line' | 'fill';
        return {
            id: layer.layer,
            type: layertype,
            source: 'tile',
            'source-layer': layer.layer,
            paint: {
                [`${layertype}-color`]: '#000000',
                [`${layertype}-opacity`]: 0.7,
            },
        } satisfies LayerSpecification;
    });
    const html = `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8" />
            <title>MapLibre GL JS</title>
            <!-- maplibre gl js-->
            <script src="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.js"></script>
            <link
                rel="stylesheet"
                href="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.css"
            />
            <style>
                body {
                    margin: 0;
                    padding: 0;
                }
                #map {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div id="map" style="height: 100vh"></div>
            <script>
                // hostname
                const tileUrl = window.location.origin + '/tiles/${id}/{z}/{x}/{y}';

                const map = new maplibregl.Map({
                    hash: true,
                    container: 'map', // container id
                    style: {
                        version: 8,
                        sources: {
                            tile: {
                                type: 'vector',
                                tiles: [tileUrl],
                                minzoom: ${minzoom},
                                maxzoom: ${maxzoom},
                            }
                        },
                        layers: ${JSON.stringify(layers)},
                    },
                    center: [0, 0], // starting position [lng, lat]
                    zoom: 1, // starting zoom
                });
            </script>
        </body>
    </html>`;

    return c.html(html);
});

app.get('/tiles/:id/metadata.json', async (c) => {
    const id = c.req.param('id');
    const pmtiles = await getPmtilesInstance(id);
    const metadata = await pmtiles.getMetadata();
    return c.json(metadata);
});

app.get('/tiles/:id/tiles.json', async (c) => {
    const id = c.req.param('id');
    // make tiles.json data
    const pmtiles = await getPmtilesInstance(id);
    const metadata = (await pmtiles.getMetadata()) as any;
    const tilesjson = {
        tilejson: '3.0.0',
        tiles: [`${process.env.LITILER_HOST}/tiles/${id}/{z}/{x}/{y}`],
        vector_layers: metadata.vector_layers,
    };
    return c.json(tilesjson);
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
