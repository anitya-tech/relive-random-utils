import fs from "fs/promises";
import path from "path";

import { ReceivedGiftStreamList } from "@gtr/random-bilibili-api/dist/apis/live/received-gift-stream-list";
import moment from "moment-timezone";

import { getS3, S3Bucket, S3KeyPrefix } from "./config";

const datastore = "/home/geektr/playground/bilibili-gifts/datastore";
const stopDate = moment("2021-04-18");

async function start() {
  const s3 = await getS3();
  console.log("load: s3");

  for (const uid of await fs.readdir(datastore)) {
    for (const file of await fs.readdir(path.join(datastore, uid))) {
      const [, _date] = file.match(/(\d{4}-\d{2}-\d{2})/) as string[];
      const date = moment(_date);
      if (!date.isBefore(stopDate)) continue;
      console.log(uid, _date, date, date.format("YYYY-MM-DD"));

      const KeyPreifx = `${S3KeyPrefix}/${uid}/${date.format(
        "YYYY"
      )}/${date.format("MM-DD")}`;
      const JsonMetadata = {
        "content-type": "application/json",
        "cache-control": "public, max-age=31536000",
      };

      const gifts: ReceivedGiftStreamList.Record[] = JSON.parse(
        await fs.readFile(path.join(datastore, uid, file), "utf-8")
      );
      if (gifts.length) {
        await s3
          .putObject({
            Bucket: S3Bucket,
            Key: `${KeyPreifx}.all.json`,
            Metadata: JsonMetadata,
            Body: JSON.stringify(gifts),
          })
          .promise();
      }
      const goldGifts = gifts.filter((i) => i.gold);
      if (goldGifts.length) {
        await s3
          .putObject({
            Bucket: S3Bucket,
            Key: `${KeyPreifx}.gold.json`,
            Metadata: JsonMetadata,
            Body: JSON.stringify(goldGifts),
          })
          .promise();
      }
    }
  }
}

async function fixMetadata() {
  const s3 = await getS3();

  let ContinuationToken: string | undefined;

  do {
    const { Contents, NextContinuationToken } = await s3
      .listObjectsV2({
        ContinuationToken,
        Bucket: S3Bucket,
        Prefix: S3KeyPrefix,
        MaxKeys: 100,
      })
      .promise();

    if (!Contents) break;

    for (const obj of Contents) {
      const Key = obj.Key as string;
      console.log(Key);
      if (!/^live-gifts\/\d+\/\d{4}\/\d{2}-\d{2}[^/]*\.json$/.test(Key)) {
        console.log("continue");
        continue;
      }

      const resp = await s3.getObject({ Bucket: S3Bucket, Key }).promise();

      const Metadata = resp.Metadata || {};

      if (Metadata["content-type"] || Metadata["cache-control"]) {
        const ContentType =
          Metadata["content-type"] || resp.ContentType || undefined;
        const CacheControl =
          Metadata["cache-control"] || resp.CacheControl || undefined;

        delete Metadata["content-type"];
        delete Metadata["cache-control"];

        console.log(ContentType);
        console.log(CacheControl);
        console.log(Metadata);

        await s3
          .putObject({
            Body: resp.Body,
            Bucket: S3Bucket,
            Key,
            ContentType,
            CacheControl,
            Metadata,
          })
          .promise();
      }
    }

    ContinuationToken = NextContinuationToken;
  } while (ContinuationToken);
}

fixMetadata();
