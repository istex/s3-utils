import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { Readable } from "stream";

let s3Client: S3Client | undefined;

function initS3Client(config: { endpoint: string, credentials: { accessKeyId: string, secretAccessKey: string } }) {
  return new S3Client({
    endpoint: config.endpoint,
    credentials: config.credentials,
    forcePathStyle: true,
    region: "us-east-1"
  })
}

export function getS3Client(config?: { endpoint: string, credentials: { accessKeyId: string, secretAccessKey: string } }) {
  if (s3Client == null) {
    if (config == null) {
      throw new Error("S3 client cannot be created with empty configuration. Please consider calling the function with a correct config object.");
    }
    s3Client = initS3Client(config);
  }
  return s3Client;
}

export async function putFileToS3(bucket: string, key: string, file: Buffer<ArrayBuffer>, s3Client?: S3Client) {
  s3Client ??= getS3Client();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
    })
  )
}

export async function getFileFromS3(bucket: string, key: string, s3Client?: S3Client) {
  s3Client ??= getS3Client();
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );
  return response.Body;
}

export async function* listObjectsGenerator(bucket: string, prefix: string, options?: { maxKeys?: number, delimiter?: string, s3Client?: S3Client }) {
  const s3Client = options?.s3Client ?? getS3Client();
  let continuationToken: string | undefined;

  for (; ;) {
    const result = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: options?.delimiter,
      MaxKeys: options?.maxKeys ?? 1000,
      ContinuationToken: continuationToken,
    }));

    if (result.Contents != null) {
      for (const obj of result.Contents) {
        yield obj;
      }
    }

    if (result.IsTruncated == null || !result.IsTruncated) break;
    if (result.NextContinuationToken == null) throw new Error("NextContinuationToken is undefined.");
    continuationToken = result.NextContinuationToken;
  }
}

export function getListObjectsFromS3(bucket: string, prefix: string, options?: { maxKeys?: number, delimiter?: string, s3Client?: S3Client }) {
  return Readable.from(listObjectsGenerator(bucket, prefix, options), { objectMode: true });
}

export async function s3FileExists(bucket: string, key: string, s3Client?: S3Client) {
  s3Client ??= getS3Client();
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getHeadObjectFromS3(bucket: string, key: string, s3Client?: S3Client) {
  s3Client ??= getS3Client();
  return await s3Client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
}

// For tests
export function resetS3Client() {
  s3Client = undefined;
}

export function getEnvConfig() {
  if (process.env.S3_ENDPOINT == null) {
    throw new Error("Missing environment variable S3_ENDPOINT");
  }
  if (process.env.S3_KEY_ID == null) {
    throw new Error("Missing environment variable S3_KEY_ID");
  }
  if (process.env.S3_ACCESS_KEY == null) {
    throw new Error("Missing environment variable S3_ACCESS_KEY");
  }
  return { endpoint: process.env.S3_ENDPOINT, credentials: { accessKeyId: process.env.S3_KEY_ID, secretAccessKey: process.env.S3_ACCESS_KEY } };
}

export async function getSHA1OfObject(bucket: string, key: string, s3Client?: S3Client) {
  const obj = await getFileFromS3(bucket, key, s3Client);
  const buffer = await obj?.transformToByteArray()
  if (buffer === undefined) {
    throw new Error("Buffer was undefined");
  }
  return createHash("sha1").update(buffer).digest("hex");
}
