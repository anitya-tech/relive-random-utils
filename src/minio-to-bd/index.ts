import fs from "fs";
import path from "path";
import { Readable } from "stream";

import { hash, pipeline } from "@gtr/utils";
import { EasyS3, initMinio } from "infra-minio-v0";
import { execFile } from "mz/child_process";

import { getLogger } from "../common/log";
import { FileMeta, fileTypeMap, parseDateTime } from "../common/utils";

const parseKey = (key: string) => {
  const result = key.match(
    /(?<fullpath>stream\/(?<encode_state>raw|encoded)\/(?<room_id>\d+)\/(?<date>\d{8}))\/(?<filename>(?<time>\d{6})\.(?<extension>\w+))/
  );
  if (!result?.groups) throw `parse error: ${key}`;

  const { room_id, date, time, extension, filename, fullpath } = result.groups;
  return { room_id, date, time, extension, filename, fullpath };
};

const transfer = async (roomId: number) => {
  const minio = await initMinio("projects/anitya/relive/base/minio/rw");
  const bucket = "relive-bili";
  const s3 = new EasyS3(minio, bucket);

  // const redis = await initRedis("projects/anitya/relive/base/redis/rw");
  // const redisBuild = new RedisStackBuilder(redis, "minio2bd");
  // const minioScanState = redisBuild.json<LoopState>("scan-state");

  const logger = await getLogger(`minio2bd-${roomId}`, new Date().toString());
  const tempdir = await fs.promises.mkdtemp(`/tmp/minio2bd.${roomId}.`);

  const uploadBdpcs = async (files: string[], distdir: string) => {
    const resolve = (f: string) => path.join(distdir, path.basename(f));
    let log: string;

    try {
      const [_log, _err] = await execFile("bdpcs", [
        "upload",
        ...files,
        distdir,
      ]);
      log = _log;
      logger.error(_err);
    } catch (e) {
      console.log(e);
      throw e;
    }

    for (const file of files) {
      const bdpath = resolve(file);
      const success =
        log.includes(`上传文件成功, 保存到网盘路径: ${bdpath}`) ||
        log.includes(`目标文件, ${bdpath}, 已存在, 跳过...`) ||
        log.includes(`秒传成功, 保存到网盘路径: ${bdpath}`);

      if (!success) {
        logger.error(bdpath);
        logger.error(log);
        throw "upload failed";
      }
    }

    return log;
  };

  const meta = s3.loopMeta({
    initState: () => ({
      Prefix: `stream/encoded/${roomId}`,
      MaxKeys: 1000,
    }),
  });

  for await (const [{ Key }, { Metadata, ContentLength }] of meta) {
    if (!Key) continue;
    logger.info("===========================================");
    logger.info(Key);
    console.log(Key);

    const { room_id, date, time, extension, filename, fullpath } =
      parseKey(Key);

    const datafile = path.join(tempdir, filename);
    const metafile = path.join(tempdir, `${filename}.meta`);
    const distdir = path.join("/", bucket, fullpath);
    logger.info(`datafile: ${datafile}`);
    logger.info(`metafile: ${datafile}`);
    logger.info(`distdir: ${distdir}`);

    logger.info("get object...");
    const { Body } = await s3.getObject({ Key });
    if (!(Body instanceof Readable)) throw `${Key} Body is not stream`;

    logger.info("hash and save object...");
    const [md5] = await Promise.all([
      hash.md5(Body),
      pipeline(Body, fs.createWriteStream(datafile)),
    ]);

    const meta: FileMeta = {
      key: Key,
      size: ContentLength as number,
      ...Metadata,
      roomId: Number(room_id),
      datetime: parseDateTime(date, time),
      type: fileTypeMap[extension],
      ext: extension,
      md5,
    };

    logger.info("write meta object...");
    await fs.promises.writeFile(metafile, JSON.stringify(meta));

    logger.info("bdpcs upload...");
    try {
      await uploadBdpcs([datafile, metafile], distdir);
      logger.info("remove remote file...");
      await s3.deleteObject({ Key });
    } catch (e) {
      console.log(`${Key}: upload failed`);
      logger.error(`${Key}: upload failed`);
    }

    logger.info("remove localfile...");
    await fs.promises.unlink(datafile);
    await fs.promises.unlink(metafile);
  }

  await fs.promises.rmdir(tempdir);
};

// const rooms = [
//   22675954, 1066544, 22608112, 251015, 21622680, 3428783,
// ];

//    22        209      271      303      501      1100

// 22675954,21622680
// 1066544,22608112,251015
// 3428783

const rooms = (process.env.ROOMS as string)?.split(",").map((i) => Number(i));

const start = async () => {
  for (const roomId of rooms) await transfer(roomId);
};

start();
