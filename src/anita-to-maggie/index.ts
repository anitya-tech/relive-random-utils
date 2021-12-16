import { PassThrough, Readable } from "stream";

import { hash } from "@gtr/utils";
import { EzBucket, initMinio } from "infra-minio-v1";
import mime from "mime";

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

const transfer = async (Prefix: string) => {
  const bucket = "relive-bili";
  const anita = new EzBucket(
    await initMinio("projects/relive/core/minio/anita/rw"),
    bucket
  );
  const maggie = new EzBucket(
    await initMinio("projects/relive/core/minio/maggie/rw"),
    bucket
  );

  const logger = await getLogger(`anita2maggie`, new Date().toString());

  const meta = anita.walkMeta({
    load: () => ({
      Prefix,
      MaxKeys: 1000,
    }),
    save: console.log,
  });

  for await (const [{ Key, Metadata, ContentLength }, Obj] of meta) {
    if (!Key) continue;

    logger.info("===========================================");
    logger.info(Key);
    console.log(Key);

    const { room_id, date, time, extension } = parseKey(Key);

    logger.info("get object...");
    const { Body } = await Obj.getObject({});
    if (!(Body instanceof Readable)) throw `${Key} Body is not stream`;

    logger.info("start upload...");
    const uploadPromise = maggie.mkObject(Key).putObject({
      Body: Body.pipe(new PassThrough()),
      ContentLength,
      ContentType: mime.getType(extension) || undefined,
    });
    logger.info("start hash...");
    const md5Promise = hash.md5(Body);

    const metaPromise: Promise<FileMeta> = md5Promise.then((md5) => ({
      key: Key,
      size: ContentLength as number,
      ...Metadata,
      roomId: Number(room_id),
      datetime: parseDateTime(date, time),
      type: fileTypeMap[extension],
      ext: extension,
      md5,
    }));

    logger.info("start upload meta...");
    const uploadMetaPromise = metaPromise.then((meta) =>
      maggie.mkObject(`${Key}.meta`).putObject({
        Body: JSON.stringify(meta),
        ContentType: "application/json",
      })
    );

    await Promise.all([uploadPromise, uploadMetaPromise]);
    await Obj.deleteObject({});
  }
};

// stream/encoded/
transfer(process.argv[2]);
