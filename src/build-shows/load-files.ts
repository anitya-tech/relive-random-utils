import fs from "fs/promises";

import { getLogger } from "../common/log";

import { CmsApi } from "./cms-api";

const limit = 1000;
const end = Infinity;

export interface StorageFile {
  storage_policy: string;
  path: string;
  size: string;
  hash: string;
  state: number;
  meta: any;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

const queryFiles = async (
  storage_policy: string,
  start: number
): Promise<StorageFile[]> => {
  const { data } = await CmsApi.instance.get("/storage-files", {
    params: { _limit: limit, _start: start, storage_policy_eq: storage_policy },
  });

  return data;
};

export type FileType = "audio" | "raw_video" | "video" | "danmaku" | "cover";

export interface File {
  type: FileType;
  datetime: Date;
  id: string;
  roomId: number;
  // source: StorageFile;
}

const filePool: File[] = [];

// const storage_policy_store = {
//   // aliyun_oss/stream-publish
//   oss: "60fad5673d6abc5af13bdbc7",
//   // minio/Anita
//   minio_anita: "60f985ef72a62f7dd74fd0ef",
//   // minio/Tomoyo
//   minio_tomoyo: "60fa972f72a62f7dd7507d14",
//   // baidu_wangpan/Anitya
//   baidu_wangpan: "60f6650fa96d0a4665400ef4",
// };
const storage_policy_store = {
  // aliyun_oss/stream-publish
  oss: "60fbf05053f921003598a2de",
  // minio/Anita
  minio_anita: "60fbf0ad53f921003598a2df",
  // minio/Tomoyo
  minio_tomoyo: "60fbf0bc53f921003598a2e0",
  // baidu_wangpan/Anitya
  baidu_wangpan: "60fbf0bc53f921003598a2e1",
};

async function* loopFiles(storage_policy: string) {
  let start = 0;
  while (true) {
    try {
      const list = await queryFiles(storage_policy, start);
      if (!list.length) break;
      for (const item of list) {
        yield item;
      }
    } catch (e) {
      console.log(e);
    }

    start += limit;
  }
}

const task_id = new Date().getTime().toString(36);

const fileTypeMap: Record<string, FileType> = {
  xml: "danmaku",
  mp3: "audio",
  mp4: "video",
  flv: "raw_video",
  jpg: "cover",
  png: "cover",
};

const parseDateTime = (date: string, time: string): Date => {
  const _date = date.match(/(\d{4})(\d{2})(\d{2})/);
  const _time = time.match(/(\d{2})(\d{2})(\d{2})/);
  if (!_date || !_time) throw `datetime parse error: ${date} ${time}`;

  const [, year, month, day] = _date;
  const [, hour, minute, second] = _time;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
};

const run = async () => {
  const logger = await getLogger("load-files", task_id);

  let count = 0;

  // baidu wangpan
  for await (const item of loopFiles(storage_policy_store.baidu_wangpan)) {
    if (++count >= end) break;
    const result = item.path.match(
      /\/relive-bili\/stream\/(?<encode_state>raw|encoded)\/(?<room_id>\d+)\/(?<date>\d{8})\/(?<time>\d{6})\.(?<extension>\w+)/
    );
    if (!result?.groups) {
      logger.error(`${storage_policy_store.baidu_wangpan}: ${item.path}`);
      continue;
    }
    const { room_id, date, time, extension } = result.groups;

    filePool.push({
      id: item.id,
      roomId: Number(room_id),
      datetime: parseDateTime(date, time),
      type: fileTypeMap[extension],
      // source: item,
    });
  }

  // OSS
  for await (const item of loopFiles(storage_policy_store.oss)) {
    if (++count >= end) break;
    const result = item.path.match(
      /bilibili\/(?<room_id>\d+)\/record\/(?<date>\d{8})\/(?<time>\d{6})\.(?<extension>\w+)/
    );

    if (!result?.groups) {
      logger.error(`${storage_policy_store.oss}: ${item.path}`);
      continue;
    }
    const { room_id, date, time, extension } = result.groups;

    const known_keys = ["client", "task_id"];
    const unknown_key = Object.keys(item.meta).find(
      (i) => !known_keys.includes(i)
    );

    if (unknown_key) {
      throw `unknown file meta property: ${unknown_key}`;
    }

    filePool.push({
      id: item.id,
      roomId: Number(room_id),
      datetime: parseDateTime(date, time),
      type: fileTypeMap[extension],
      // source: item,
    });
  }

  // minio_tomoyo
  for await (const item of loopFiles(storage_policy_store.minio_tomoyo)) {
    if (++count >= end) break;
    const result = item.path.match(
      /stream\/(?<encode_state>raw|encoded)\/(?<room_id>\d+)\/(?<date>\d{8})\/(?<time>\d{6})\.(?<extension>\w+)/
    );

    if (!result?.groups) {
      logger.error(`${storage_policy_store.minio_tomoyo}: ${item.path}`);
      continue;
    }
    const { room_id, date, time, extension } = result.groups;

    filePool.push({
      id: item.id,
      roomId: Number(room_id),
      datetime: parseDateTime(date, time),
      type: fileTypeMap[extension],
      // source: item,
    });
  }

  // minio_anita
  for await (const item of loopFiles(storage_policy_store.minio_anita)) {
    if (++count >= end) break;
    const result = item.path.match(
      /stream\/(?<encode_state>raw|encoded)\/(?<room_id>\d+)\/(?<date>\d{8})\/(?<time>\d{6})\.(?<extension>\w+)/
    );

    if (!result?.groups) {
      logger.error(`${storage_policy_store.minio_anita}: ${item.path}`);
      continue;
    }
    const { room_id, date, time, extension } = result.groups;

    const datetime = parseDateTime(date, time);

    const meta = item.meta;
    delete meta.client;
    delete meta.task_id;
    // 修改时间，rclone 添加
    delete meta.mtime;
    delete meta.md5chksum;
    if (meta.source === "old-store") {
      delete meta.source;
    }

    const millisec = Number(meta.millisecond);
    if (millisec && millisec < 1000) {
      datetime.setMilliseconds(millisec);
      delete meta.millisecond;
    }

    const unknown_key = Object.keys(meta);

    if (unknown_key.length) {
      console.log(item.path);
      console.log(meta);
      throw `unknown file meta property`;
    }

    filePool.push({
      id: item.id,
      roomId: Number(room_id),
      datetime,
      type: fileTypeMap[extension],
      // source: item,
    });
  }

  await fs.writeFile("logs/files.json", JSON.stringify(filePool));
};

run();
