import fs from "fs/promises";
import path from "path";

import { LiveRoom } from "@gtr/random-bilibili-api";
import { EasyS3 } from "infra-minio-v0";
import moment from "moment-timezone";

import { getAnita, S3Bucket, S3KeyPrefix } from "./config";

const datastore = "/home/geektr/playground/bilibili-gifts/datastore";
const stopDate = moment("2021-04-18");

async function start() {
  const s3 = new EasyS3(getAnita(), S3Bucket, S3KeyPrefix);
  console.log("load: s3");

  for (const uid of await fs.readdir(datastore)) {
    for (const file of await fs.readdir(path.join(datastore, uid))) {
      const [, _date] = file.match(/(\d{4}-\d{2}-\d{2})/) as string[];
      const date = moment(_date);
      if (!date.isBefore(stopDate)) continue;
      console.log(uid, _date, date, date.format("YYYY-MM-DD"));

      const KeyPreifx = `${uid}/${date.format("YYYY")}/${date.format("MM-DD")}`;
      const JsonMetadata = {
        "content-type": "application/json",
        "cache-control": "public, max-age=31536000",
      };

      const gifts: LiveRoom.ReceivedGiftStreamList.Record[] = JSON.parse(
        await fs.readFile(path.join(datastore, uid, file), "utf-8")
      );
      if (gifts.length) {
        await s3.putObject({
          Key: `${KeyPreifx}.all.json`,
          Metadata: JsonMetadata,
          Body: JSON.stringify(gifts),
        });
      }
      const goldGifts = gifts.filter((i) => i.gold);
      if (goldGifts.length) {
        await s3.putObject({
          Key: `${KeyPreifx}.gold.json`,
          Metadata: JsonMetadata,
          Body: JSON.stringify(goldGifts),
        });
      }
    }
  }
}

async function fixMetadata() {
  const s3 = new EasyS3(getAnita(), S3Bucket);

  const objGenerator = s3.loopObjects({
    initState: () => ({ Prefix: S3KeyPrefix, MaxKeys: 100 }),
  });

  for await (const obj of objGenerator) {
    const Key = obj.Key as string;
    console.log(Key);
    if (!/^live-gifts\/\d+\/\d{4}\/\d{2}-\d{2}[^/]*\.json$/.test(Key)) {
      console.log("continue");
      continue;
    }

    const resp = await s3.getObject({ Key });

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

      await s3.putObject({
        Body: resp.Body,
        Key,
        ContentType,
        CacheControl,
        Metadata,
      });
    }
  }
}

fixMetadata();
