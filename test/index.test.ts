import {
  getS3Client,
  putObjectToS3,
  getObjectFromS3,
  getListObjectsFromS3,
  s3FileExists,
  getHeadObjectFromS3,
  getEnvConfig,
  getSHA1OfObject,
} from "../src/index.js";
import { S3Client, type _Object, type S3ClientConfig } from "@aws-sdk/client-s3";
import { createS3Client } from "mock-aws-s3-v3";
import fs from "fs";
import { finished } from "stream/promises";
import { describe, it, expect, afterAll } from "vitest";
import { createHash } from "crypto";

const config = {
  endpoint: "http://0.0.0.0:9000",
  credentials: {
    accessKeyId: "dev",
    secretAccessKey: "devpasswd",
  },
};

describe("getS3Client(config)", () => {
  it("Should return an instance of an S3Client", () => {
    expect(getS3Client(config) instanceof S3Client).toBe(true);
  });
});

describe("putFileToS3(bucket, key, file, s3Client)", () => {
  afterAll(() => {
    fs.rm("test/s3_mock/dev/put_test", { recursive: true }, (err) => {
      if (err != null) console.error(err);
    });
  });

  const mockClient = createS3Client({
    localDirectory: "./test/s3_mock",
    bucket: "dev",
  });

  it("Should write the file in S3 (test/s3_mock) successfully", async () => {
    const file = fs.readFileSync("test/test.xml");

    await putObjectToS3("dev", "put_test/test.xml", file, mockClient);

    fs.readFileSync("test/s3_mock/dev/put_test/test.xml");
  });
});

describe("getFileFromS3(bucket, key, s3Client)", () => {

  it("Should get the file from S3 (test/mock) successfully", async () => {
    const mockClient = createS3Client({
      localDirectory: "./test/s3_mock",
      bucket: "dev",
    });

    const s3File = await getObjectFromS3("dev", "get_test/test.xml", mockClient);
    expect(s3File).not.toBeUndefined();

    expect(await s3File.Body?.transformToString()).toBe(
      fs.readFileSync("test/s3_mock/dev/get_test/test.xml").toString(),
    );
  });
});

describe("getListObjectsFromS3(bucket, prefix, s3Client)", () => {

  it("Should get the list of files from S3 (50 subfolders with 1 XML file and 1 PDF file each))", async () => {
    const mockClient = createS3Client({
      localDirectory: "./test/s3_mock",
      bucket: "dev",
    });

    const streamNoMaxKeys = getListObjectsFromS3(
      "dev",
      "get_list_object_test", mockClient,
      { delimiter: "arbitrary delimiter" },
    );

    const objectsNoMaxKeys: _Object[] = [];
    streamNoMaxKeys.on("data", (data: _Object) => {
      objectsNoMaxKeys.push(data);
    });

    await finished(streamNoMaxKeys);

    const streamMaxKeys = getListObjectsFromS3(
      "dev",
      "get_list_object_test",
      mockClient,
      {
        delimiter: "arbitrary delimiter",
        maxKeys: 2,
      },
    );

    const objectsMaxKeys: _Object[] = [];
    streamMaxKeys.on("data", (data: _Object) => {
      objectsMaxKeys.push(data);
    });

    await finished(streamMaxKeys);

    expect(objectsMaxKeys).toEqual(objectsNoMaxKeys);
    expect(objectsNoMaxKeys.length).toBe(100);

    expect(
      objectsNoMaxKeys.filter((o) => o.Key?.toString().endsWith(".pdf") === true).length,
    ).toBe(50);

    expect(
      objectsNoMaxKeys.filter((o) => o.Key?.toString().endsWith(".xml") === true).length,
    ).toBe(50);

    expect(
      objectsNoMaxKeys.filter((o) =>
        o.Key?.toString().includes("33/file33.pdf") === true,
      ).length,
    ).toBe(1);
  });
});

describe("s3FileExists(bucket, key, s3Client)", () => {
  const mockClient = createS3Client({
    localDirectory: "./test/s3_mock",
    bucket: "dev",
  });

  it("Should return true for an existing file", async () => {
    expect(await s3FileExists("dev", "get_test/test.xml", mockClient)).toBe(
      true,
    );
  });

  it("Should return false for a non existing file", async () => {
    expect(await s3FileExists("dev", "get_test/bana.na", mockClient)).toBe(
      false,
    );

    const mockClient2 = createS3Client({
      localDirectory: "s3_mock",
      bucket: "banana",
    });

    expect(
      await s3FileExists("banana", "banana/bana.na", mockClient2),
    ).toBe(false);
  });
});

describe("getHeadObjectFromS3(bucket, key, s3Client)", () => {
  const mockClient = createS3Client({
    localDirectory: "./test/s3_mock",
    bucket: "dev",
  });

  it("Should return HeadObject of the existing file", async () => {
    const res = await getHeadObjectFromS3(
      "dev",
      "get_test/test.xml",
      mockClient,
    );

    expect(res).not.toBeUndefined();
    expect(res.ContentLength).toBe(4542);
  });

  it("Should throw an error trying to fetch the head of a non-existing object", async () => {
    await expect(
      getHeadObjectFromS3("dev", "put_test/test.xml", mockClient),
    ).rejects.toThrow();
  });
});

describe("getEnvConfig()", () => {
  it("Should create the config successfully", () => {
    process.env.S3_ENDPOINT = "http://example:9000";
    process.env.S3_KEY_ID = "4zot3";
    process.env.S3_ACCESS_KEY = "4n0th34un1ver53";
    const config: S3ClientConfig = getEnvConfig();
    expect(config.endpoint).to.be.equal("http://example:9000");
    expect((config.credentials)).to.deep.equal({ accessKeyId: "4zot3", secretAccessKey: "4n0th34un1ver53" });
  });
  it("Should throw an exception because the S3_ENDPOINT varible is missing", () => {
    delete process.env.S3_ENDPOINT;
    process.env.S3_KEY_ID = "4zot3";
    process.env.S3_ACCESS_KEY = "4n0th34un1ver53";
    expect(getEnvConfig).toThrow("Missing environment variable S3_ENDPOINT");
  })
  it("Should throw an exception because the S3_KEY_ID varible is missing", () => {
    process.env.S3_ENDPOINT = "http://example:9000";
    delete process.env.S3_KEY_ID;
    process.env.S3_ACCESS_KEY = "4n0th34un1ver53";
    expect(getEnvConfig).toThrow("Missing environment variable S3_KEY_ID");
  })
  it("Should throw an exception because the S3_ACCESS_KEY varible is missing", () => {
    process.env.S3_ENDPOINT = "http://example:9000";
    delete process.env.S3_ACCESS_KEY;
    process.env.S3_KEY_ID = "4zot3";
    expect(getEnvConfig).toThrow("Missing environment variable S3_ACCESS_KEY");
  })
})

describe("getSHA1OfObject(bucket, key, s3Client)", () => {

  it("Should return the SHA1 of an existing object", async () => {
    const mockClient = createS3Client({
      localDirectory: "./test/s3_mock",
      bucket: "dev",
    });

    const expected = createHash("sha1")
      .update(fs.readFileSync("test/s3_mock/dev/get_test/test.xml"))
      .digest("hex");

    const sha1 = await getSHA1OfObject(
      "dev",
      "get_test/test.xml",
      mockClient,
    );

    expect(sha1).toBe(expected);
  });

  it("Should throw an error for a non-existing object", async () => {
    const mockClient = createS3Client({
      localDirectory: "./test/s3_mock",
      bucket: "dev",
    });

    await expect(
      getSHA1OfObject("dev", "get_test/does_not_exist.xml", mockClient),
    ).rejects.toThrow();
  });
});
