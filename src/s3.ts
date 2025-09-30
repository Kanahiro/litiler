import {
	GetObjectCommand,
	GetObjectCommandOutput,
	S3Client,
	S3ClientConfig,
} from '@aws-sdk/client-s3';
import { PMTiles, RangeResponse, Source } from 'pmtiles';

// singleton
let s3Client: S3Client;
function getS3Client(config: S3ClientConfig) {
	if (!s3Client) {
		s3Client = new S3Client(config);
	}
	return s3Client;
}

class S3Source implements Source {
	bucket: string;
	key: string;
	s3Client: S3Client;

	constructor(bucket: string, key: string) {
		this.bucket = bucket;
		this.key = key;
		this.s3Client = getS3Client({
			region: process.env.LITILER_S3_REGION ?? 'us-east-1',
			endpoint: process.env.LITILER_S3_ENDPOINT,
			forcePathStyle: process.env.LITILER_S3_FORCE_PATH_STYLE === 'true',
		});
	}

	getKey() {
		return `s3://${this.bucket}/${this.key}`;
	}

	async getBytes(
		offset: number,
		length: number,
		signal?: AbortSignal,
		etag?: string,
	): Promise<RangeResponse> {
		let resp: GetObjectCommandOutput;
		try {
			resp = await this.s3Client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: this.key,
					Range: 'bytes=' + offset + '-' + (offset + length - 1),
					IfMatch: etag,
				}),
			);
		} catch (e: unknown) {
			if (e instanceof Error && (e as Error).name === 'PreconditionFailed') {
				throw new Error('etag mismatch');
			}
			throw e;
		}

		const arr = await resp.Body?.transformToByteArray();

		if (!arr) throw Error('Failed to read S3 response body');

		return {
			data: arr.buffer as ArrayBuffer, // arr.buffer won't be SharedArrayBuffer
			etag: resp.ETag,
			expires: resp.Expires?.toISOString(),
			cacheControl: resp.CacheControl,
		};
	}
}

const pmtiles_cache: Record<string, PMTiles> = {};

async function getPmtilesInstance(id: string) {
	if (!pmtiles_cache[id]) {
		const source = new S3Source(
			process.env.LITILER_S3_BUCKET!,
			id + '.pmtiles',
		);
		const pmtiles = new PMTiles(source);
		pmtiles_cache[id] = pmtiles;
	}
	return pmtiles_cache[id];
}

export { getPmtilesInstance };
