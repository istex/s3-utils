import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { Readable } from "stream";

export function getS3Client(config: { endpoint: string, credentials: { accessKeyId: string, secretAccessKey: string } }) {
  return new S3Client({
    endpoint: config.endpoint,
    credentials: config.credentials,
    forcePathStyle: true,
    region: "us-east-1"
  })
}

export async function putObjectToS3(bucket: string, key: string, file: Buffer<ArrayBuffer>, s3Client: S3Client) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
    })
  )
}

export async function getObjectFromS3(bucket: string, key: string, s3Client: S3Client) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );
  return response;
}

export async function* listObjectsGenerator(bucket: string, prefix: string, s3Client: S3Client, options?: { maxKeys?: number, delimiter?: string }) {
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

export function getListObjectsFromS3(bucket: string, prefix: string, s3Client: S3Client, options?: { maxKeys?: number, delimiter?: string, }) {
  return Readable.from(listObjectsGenerator(bucket, prefix, s3Client, options), { objectMode: true });
}

export async function s3FileExists(bucket: string, key: string, s3Client: S3Client) {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getHeadObjectFromS3(bucket: string, key: string, s3Client: S3Client) {
  return await s3Client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
}

export async function getSHA1OfObject(bucket: string, key: string, s3Client: S3Client) {
  const obj = await getObjectFromS3(bucket, key, s3Client);
  const buffer = await obj.Body?.transformToByteArray()
  if (buffer === undefined) {
    throw new Error("Buffer was undefined");
  }
  return createHash("sha1").update(buffer).digest("hex");
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
