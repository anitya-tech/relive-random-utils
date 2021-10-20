import fs from "fs/promises";

import { ReceivedGiftStreamList } from "@gtr/random-bilibili-api/dist/apis/live/received-gift-stream-list";
import moment from "moment-timezone";

import { getS3, S3Bucket, S3KeyPrefix } from "./config";
import { getRecordModel } from "./utils/dynamodb";

const cacheFile = "logs/gifts-dynamodb.json";

interface ExtRecord extends ReceivedGiftStreamList.Record {
  uploader_id: number;
}

interface GiftInfo {
  id: number;
  name: string;
  img_basic: string;
  price: number;
}

async function getGiftMap(
  file: string,
  key: string
): Promise<Record<number, GiftInfo>> {
  const s3 = await getS3();
  const _Key = `${S3KeyPrefix}/.random/${key}`;
  let list: GiftInfo[];

  try {
    const data = await s3.getObject({ Bucket: S3Bucket, Key: _Key }).promise();
    list = JSON.parse(data.Body as string);
  } catch (e) {
    const giftConfig: {
      data: { list: GiftInfo[] };
    } = JSON.parse(await fs.readFile(file, "utf-8"));

    list = giftConfig.data.list;

    await s3
      .putObject({
        Bucket: S3Bucket,
        Key: _Key,
        Body: JSON.stringify(list),
      })
      .promise();
  }

  return Object.fromEntries(list.map((i) => [i.id, i]));
}

async function downloadDb(): Promise<any[]> {
  try {
    return JSON.parse(
      (await fs.readFile(cacheFile, "utf-8")) as unknown as string
    );
  } catch {
    // do nothing
  }

  const record = await getRecordModel();

  const list: ExtRecord[] = [];
  let lastKey: any;

  do {
    console.log(lastKey);
    const result = lastKey
      ? await record.scan().startAt(lastKey).exec()
      : await record.scan().exec();

    for (const i of result) list.push(JSON.parse(JSON.stringify(i)));

    lastKey = result.lastKey;
    console.log(`${list.length}/354445`);
  } while (lastKey);

  await fs.writeFile(cacheFile, JSON.stringify(list), "utf-8");

  return list;
}

async function backup(list: any) {
  const s3 = await getS3();
  const Key = `${S3KeyPrefix}/.random/old-dynamodb-data.json`;

  try {
    await s3.headObject({ Bucket: S3Bucket, Key }).promise();
  } catch (e: any) {
    if (e.statusCode === 404) {
      await s3
        .putObject({
          Bucket: S3Bucket,
          Key,
          ContentType: "application/json",
          ContentDisposition: "attachment",
          Body: JSON.stringify(list),
        })
        .promise();
    } else {
      throw e;
    }
  }
}

async function transfer() {
  const dbList = await downloadDb();
  const s3 = await getS3();

  await backup(dbList);

  const userGifts: Record<
    number,
    Record<string, Record<string, ReceivedGiftStreamList.Record[]>>
  > = {};

  const addGift = (uid: number, gift: ReceivedGiftStreamList.Record) => {
    const date = moment.tz(gift.time, "Asia/Shanghai");
    const year = date.format("YYYY");
    const monthDay = date.format("MM-DD");

    userGifts[uid] = userGifts[uid] || {};
    userGifts[uid][year] = userGifts[uid][year] || {};
    userGifts[uid][year][monthDay] = userGifts[uid][year][monthDay] || [];

    userGifts[uid][year][monthDay].push(gift);
  };

  const giftsMap1 = await getGiftMap(
    "/home/geektr/playground/bilibili-gifts/giftConfig.17151.json",
    "gift-config.17151.json"
  );
  const giftsMap2 = await getGiftMap(
    "/home/geektr/playground/bilibili-gifts/giftConfig.json",
    "gift-config.json"
  );

  const giftsMap = { ...giftsMap1, ...giftsMap2 };

  const unknownGift: Set<number> = new Set();

  for (const i of dbList) {
    const gift = giftsMap[i.gift_id];

    if (!gift) unknownGift.add(i.gift_id);

    addGift(i.uploader_id, {
      uid: i.uid,
      uname: i.uname,
      time: moment.tz(i.time, "Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss"),
      gift_id: i.gift_id,
      gift_name: gift && gift.name,
      gift_img: gift && gift.img_basic,
      gift_num: 0,
      hamster: i.hamster,
      gold: i.gold,
      silver: i.silver,
      ios_hamster: i.ios_hamster,
      normal_hamster: i.normal_hamster,
      ios_gold: i.ios_gold,
      normal_gold: i.normal_gold,
      is_hybrid: i.is_hybrid,
    });
  }

  for (const uid in userGifts) {
    for (const year in userGifts[uid]) {
      for (const monthDay in userGifts[uid][year]) {
        const list = userGifts[uid][year][monthDay];
        list.sort(
          (x, y) => new Date(x.time).getTime() - new Date(y.time).getTime()
        );

        console.log(`${uid}/${year}/${monthDay}`);
        await s3
          .putObject({
            Bucket: S3Bucket,
            ContentType: "application/json",
            CacheControl: "public, max-age=31536000",
            Key: `${S3KeyPrefix}/${uid}/${year}/${monthDay}.all.json`,
            Body: JSON.stringify(list),
          })
          .promise();
      }
    }
  }

  console.log(unknownGift);
  await s3
    .putObject({
      Bucket: S3Bucket,
      Key: `${S3KeyPrefix}/.random/2021.10.20-import-unknown-gifts.json`,
      Body: JSON.stringify(unknownGift),
    })
    .promise();
}

transfer();
