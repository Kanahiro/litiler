import {
    GetObjectCommand,
    ListObjectsCommand,
    S3Client,
    S3ClientConfig,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type S3Options = {
    region: string;
    bucket: string;
    endpoint?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
};
function getS3Options(): S3Options {
    if (process.env.LITILER_BUCKET_REGION === undefined)
        throw new Error('S3 options are not set');
    if (process.env.LITILER_BUCKET_NAME === undefined)
        throw new Error('S3 options are not set');

    const options: S3Options = {
        region: process.env.LITILER_BUCKET_REGION,
        bucket: process.env.LITILER_BUCKET_NAME,
    };

    if (process.env.LITILER_BUCKET_ENDPOINT !== undefined) {
        options.endpoint = process.env.LITILER_BUCKET_ENDPOINT;
    }

    if (
        process.env.LITILER_BUCKET_ACCESSKEYID &&
        process.env.LITILER_BUCKET_SECRETACCESSKEY
    ) {
        options.credentials = {
            accessKeyId: process.env.LITILER_BUCKET_ACCESSKEYID,
            secretAccessKey: process.env.LITILER_BUCKET_SECRETACCESSKEY,
        };
    }

    return options as S3Options;
}

const s3Options = getS3Options();
const s3Client = getS3Client(s3Options);

async function listObjects(): Promise<string[]> {
    const data = await s3Client.send(
        new ListObjectsCommand({
            Bucket: s3Options.bucket,
        }),
    );

    if (data.Contents) {
        return data.Contents.map(
            (content) => content.Key?.split('.pmtiles')[0] ?? '',
        );
    } else {
        return [];
    }
}

async function getPresignedUrl(tile_id: string) {
    const cmd = new GetObjectCommand({
        Bucket: s3Options.bucket,
        Key: tile_id + '.pmtiles',
    });
    const url = getSignedUrl(s3Client, cmd, { expiresIn: 60 });
    return url;
}

function getS3Client(options: S3Options) {
    let s3ClientConfig: S3ClientConfig = { region: s3Options.region };
    if (options.endpoint) {
        s3ClientConfig = {
            region: s3Options.region,
            credentials: s3Options.credentials,
            forcePathStyle: true, // special option for minio
            endpoint: options.endpoint,
        };
    }
    const s3Client = new S3Client(s3ClientConfig);
    return s3Client;
}

export { listObjects, getPresignedUrl };
