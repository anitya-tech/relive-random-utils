import { exec } from "mz/child_process";
import xbytes from "xbytes";

// TODO: BaiduPCS-GO sdk

export interface ListItem {
  index: number;
  fs_id: number;
  app_id: number;
  size: number;
  created_at: Date;
  updated_at: Date;
  hash: string;
  name: string;
  is_directory: boolean;
}

const ls = async (dir_path: string): Promise<ListItem[]> => {
  const [stdout] = await exec(`bdpcs ls -l -name ${dir_path}`);
  let lines = stdout.split("\n");
  const start = lines.findIndex((i) =>
    / +# +FS ID +APP ID +文件大小 +创建日期 +修改日期 +MD5\(截图请打码\) +文件\(目录\) +/.test(
      i
    )
  );
  const end = lines.findIndex((i) =>
    / +总: [0-9.bBkKmMgGtT]+ +文件总数: \d+, 目录总数: \d+  /.test(i)
  );
  lines = lines.slice(start + 1, end);
  return lines
    .map((i) => {
      const result = i.match(
        / +(?<index>\d+) +(?<fs_id>\d+) +(?<app_id>\d+) +(?<size>.+?) +(?<create_date>\d{4}-\d{2}-\d{2}) (?<create_time>\d{2}:\d{2}:\d{2}) +(?<update_date>\d{4}-\d{2}-\d{2}) (?<update_time>\d{2}:\d{2}:\d{2}) +(?<incorrect_mark>\(可能不正确\))?(?<md5>[0-9a-z]+)? +(?<name>.+?) +/
      );
      if (!result?.groups) throw `parse error: ${i}`;

      const g = result.groups;

      return {
        index: Number(g.index),
        fs_id: Number(g.fs_id),
        app_id: Number(g.app_id),
        size: g.size === "-" ? 0 : xbytes.parse(g.size).bytes,
        created_at: new Date(`${g.create_date} ${g.create_time}`),
        updated_at: new Date(`${g.update_date} ${g.update_time}`),
        hash: !g.incorrect_mark ? g.md5 : "",
        name: g.name.replace(/\/$/, ""),
        is_directory: g.name.endsWith("/"),
      };
    })
    .filter((i) => i);
};

interface BaseMeta {
  path: string;
  name: string;
  app_id: number;
  fs_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface DirMeta extends BaseMeta {
  type: "dir";
}

export interface FileMeta extends BaseMeta {
  type: "file";
  hash?: string;
  size: number;
}

const meta = async (object_path: string): Promise<DirMeta | FileMeta> => {
  const [stdout] = await exec(`bdpcs meta ${object_path}`);
  let lines = stdout.split("\n");
  lines = lines.slice(2, -2);
  const map = Object.fromEntries(
    lines.map((i) => {
      const [key, ...others] = i.trim().split(/ +/);
      return [key, others];
    })
  );

  try {
    const result: DirMeta = {
      type: "dir",
      path: (map["文件路径"] || map["目录路径"])[0],
      name: (map["文件名称"] || map["目录名称"])[0],
      app_id: Number(map["app_id"][0]),
      fs_id: Number(map["fs_id"][0]),
      created_at: new Date(map["创建日期"].join(" ")),
      updated_at: new Date(map["修改日期"].join(" ")),
    };

    if (map["类型"][0] === "文件") {
      const file: FileMeta = {
        ...result,
        type: "file",
        hash: map["md5"][0] === "(可能不正确)" ? "" : map["md5"][1],
        size: Number(map["文件大小"][0].slice(0, -1)),
      };

      return file;
    }

    return result;
  } catch (e) {
    console.error(stdout);
    throw e;
  }
};

export const bdpcs = { ls, meta };

// ls("/temp/59421/").then(console.log);
// ls("/temp/59421/20210712/").then(console.log);

// meta("/temp/59421/20210712").then(console.log);
// meta("/temp/59421/20210712/011936.xml").then(console.log);
