import { BiliApi, LiveRoom } from "@gtr/random-bilibili-api";
import { EasyS3 } from "infra-minio-v0";
import moment from "moment";

import {
  fetchPageSize,
  getMaggie,
  getRedis,
  S3Bucket,
  S3KeyPrefix,
  uploaderIdMap,
} from "./config";

const fetchOneDay = async (api: BiliApi, date: moment.Moment) => {
  let page = 0;
  const giftRecordList: LiveRoom.ReceivedGiftStreamList.Record[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const data = await api.liveroom.receivedGiftStreamList({
        page,
        size: fetchPageSize,
        coin_type: 0,
        begin_time: date,
      });
      await new Promise((r) => setTimeout(r, 2000));

      giftRecordList.push(...data.list);

      const fetched = (page + 1) * fetchPageSize;
      console.log(`${fetched}/${data.total}`);
      if (fetched >= data.total) break;

      page++;
    } catch (e: any) {
      if (e.message === "syserr") continue;
    }
  }

  return giftRecordList;
};

async function syncHistory(uid: number) {
  console.log(`UID: ${uid}`);

  const api = new BiliApi({
    vaultCookieItem: { scope: "private", id: uid },
  });
  console.log("load: cookie");

  const redis = await getRedis();
  console.log("load: redis");
  const s3 = new EasyS3(getMaggie(), S3Bucket, S3KeyPrefix);
  console.log("load: s3");

  const now = moment.tz("Asia/Shanghai");
  const pointerText = await redis.get(`${uid}:pointer`);
  console.log(`redis pointer: ${pointerText || "none"}`);

  const pointer = pointerText
    ? moment(pointerText).subtract(1)
    : now.clone().subtract(179, "day");

  console.log("start");
  while (pointer.isBefore(now, "day")) {
    console.log(`[${pointer.format("YYYY/MM/DD")}]`);
    const gifts = await fetchOneDay(api, pointer);

    const KeyPreifx = `${uid}/${pointer.format("YYYY")}/${pointer.format(
      "MM-DD"
    )}`;

    const params = {
      ContentType: "application/json",
      CacheControl: "public, max-age=31536000",
    };

    if (gifts.length) {
      await s3.putObject({
        ...params,
        Key: `${KeyPreifx}.all.json`,
        Body: JSON.stringify(gifts),
      });
    }

    const goldGifts = gifts.filter((i) => i.hamster);
    if (goldGifts.length) {
      await s3.putObject({
        ...params,
        Key: `${KeyPreifx}.gold.json`,
        Body: JSON.stringify(goldGifts),
      });
    }

    await redis.set(`${uid}:pointer`, pointer.toISOString());

    pointer.add(1, "day");
  }
}

async function syncAll() {
  await syncHistory(uploaderIdMap.tsukasa);
  await syncHistory(uploaderIdMap.horo);

  (await getRedis()).disconnect();
}

syncAll();
