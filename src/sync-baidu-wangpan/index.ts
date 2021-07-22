import path from "path";
import { bdpcs } from "./bdpcs";
import { cms } from "../relive-cms/relive-cms";

// TODO: fixmd5

const baseDir = "/relive-bili";

const encoded = path.join(baseDir, "stream/encoded");

const storage_policy = "60f6650fa96d0a4665400ef4";

// const breakPoint = "";
const breakPoint = "/relive-bili/stream/encoded/5275/20210218/175437.mp3";

const traverseBaiduWangpan = async () => {
  const rooms = await bdpcs.ls(encoded);

  let skip = !!breakPoint;

  for (const room of rooms) {
    // ./17961
    const roomDir = path.join(encoded, room.name);
    const dates = await bdpcs.ls(roomDir);
    for (const date of dates) {
      // ./17961/20201209
      const dateDir = path.join(roomDir, date.name);
      const files = await bdpcs.ls(dateDir);
      for (const file of files) {
        // ./17961/20201209/235248.xml
        const filePath = path.join(dateDir, file.name);

        if (breakPoint) {
          if (filePath === breakPoint) {
            skip = false;
            continue;
          }
          if (skip) continue;
        }

        let fileMeta;

        try {
          fileMeta = await bdpcs.meta(filePath);
        } catch {
          console.error(`fetch meta failed, retry after 3s`);
          await new Promise((r) => setTimeout(r, 3000));
          fileMeta = await bdpcs.meta(filePath);
        }

        if (fileMeta.type === "dir")
          throw Error(`error, can't be directory: ${filePath}`);

        await cms.addFile({
          storage_policy,
          path: fileMeta.path,
          size: fileMeta.size,
          hash: fileMeta.hash || "",
          state: fileMeta.hash ? 0 : 1001,
          // 0: completed, 1001: require hash fix
        });
        console.log(filePath);
      }
    }
  }
};

traverseBaiduWangpan();
