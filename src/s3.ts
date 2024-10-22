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
    forcePathStyle?: boolean;
};
function getS3Options(env: any): S3Options {
    if (env.LITILER_S3_REGION === undefined)
        throw new Error('S3 options are not set');
    if (env.LITILER_S3_BUCKET === undefined)
        throw new Error('S3 options are not set');

    const options: S3Options = {
        region: env.LITILER_S3_REGION,
        bucket: env.LITILER_S3_BUCKET,
    };

    if (env.LITILER_S3_ENDPOINT !== undefined) {
        options.endpoint = env.LITILER_S3_ENDPOINT;
    }

    if (env.DEVELOP === '1') {
        options.forcePathStyle = true;
    }

    return options as S3Options;
}

let s3Options: S3Options;
let s3Client: S3Client;

function initS3(env: any) {
    s3Options = getS3Options(env);
    s3Client = getS3Client(env);
}

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
    const url = getSignedUrl(s3Client, cmd, { expiresIn: 604800 });
    return url;
}

function getS3Client(env: any) {
    let s3ClientConfig: S3ClientConfig = { region: s3Options.region };
    if (s3Options.endpoint) {
        // S3 compatible storage: R2,minio
        s3ClientConfig = {
            region: s3Options.region,
            credentials: {
                accessKeyId: env.LITILER_ACCESS_KEY_ID!,
                secretAccessKey: env.LITILER_SECRET_ACCESS_KEY!,
            },
            endpoint: s3Options.endpoint,
            forcePathStyle: s3Options.forcePathStyle,
        };
    }
    const s3Client = new S3Client(s3ClientConfig);
    return s3Client;
}

export { initS3, listObjects, getPresignedUrl };
