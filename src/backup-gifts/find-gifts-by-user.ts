import { Readable, Stream } from "stream";

import { LiveRoom } from "@gtr/random-bilibili-api";
import { EzBucket, initMinio } from "infra-minio-v1";

async function stream2buffer(stream: Stream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const _buf = Array<any>();

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", (err) => reject(`error converting stream - ${err}`));
  });
}

async function findGiftsByUser(
  server: string,
  streamerId: number,
  userId: number
) {
  if (!userId) return;

  const s3 = new EzBucket(
    initMinio(`projects/relive/core/minio/${server}/rw`),
    "relive-bili"
  );

  const objs = s3.walkEzObjects({
    Prefix: `live-gifts/${streamerId}`,
  });

  for await (const item of objs) {
    if (!item.keyWithBucket.endsWith("all.json")) continue;
    const { Body } = await item.getObject({});
    const data: LiveRoom.ReceivedGiftStreamList.Record[] = JSON.parse(
      (await stream2buffer(Body as Readable)).toString()
    );

    data
      .filter((i) => i.uid === userId)
      .forEach((g) =>
        console.log(
          `${g.time}|${g.uname}|${g.gift_name}|${g.gift_num}|${g.gold}`
        )
      );
  }
}

const start = async () => {
  const [streamerId, userId] = process.argv.slice(2).map((i) => Number(i));
  await findGiftsByUser("anita", streamerId, userId);
  await findGiftsByUser("maggie", streamerId, userId);
};

start();
