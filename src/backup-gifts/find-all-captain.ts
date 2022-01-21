import { LiveRoom } from "@gtr/random-bilibili-api";
import { EasyS3 } from "infra-minio-v0";

import { getAnita, S3Bucket, S3KeyPrefix } from "./config";

async function findAllCaptain() {
  const s3 = new EasyS3(getAnita(), S3Bucket);

  const objGenerator = s3.loopObjects({
    initState: () => ({ Prefix: S3KeyPrefix, MaxKeys: 100 }),
  });

  for await (const { Key } of objGenerator) {
    if (!Key) continue;
    console.log(Key);

    const match = Key.match(
      /^(live-gifts\/\d+\/\d{4}\/\d{2}-\d{2})\.all\.json$/
    );

    if (!match) {
      console.log("continue");
      continue;
    }

    const prefix = match[1];

    const resp = await s3.getObject({ Key });

    const Body = JSON.stringify(
      (resp.Body as LiveRoom.ReceivedGiftStreamList.Record[]).filter(
        (i) => i.hamster
      )
    );

    await s3.putObject({
      Body,
      Key: `${prefix}.gold.json`,
      ContentType: resp.ContentType,
      CacheControl: resp.CacheControl,
      Metadata: resp.Metadata,
    });
  }
}

findAllCaptain();
