import fs from "fs/promises";

import { CmsApi } from "./cms-api";
import { batchCreateUsers } from "./create-user";
import { File } from "./load-files";
export interface VideoClip {
  start_time: Date;
  store: string[];
  duration: number;
  remark: string;
  thumbnail: string[];
  origin: string[];
  audio: string[];
}

export interface DanmakuClip {
  start_time: Date;
  duration: number;
  store: string[];
  remark: string;
}

export interface Show {
  remark: string;
  marks: any[];
  video_track: VideoClip[];
  start_time: Date;
  area_id: number;
  duration: number;
  title: string;
  danmaku_track: DanmakuClip[];
  room_id: number;
}

const applyShow = async (show: Show): Promise<void> => {
  await CmsApi.instance.post("/relive-shows", show);
};

const run = async () => {
  const files: File[] = JSON.parse(
    await fs.readFile("logs/files.json", "utf-8")
  );
  files.forEach((i) => (i.datetime = new Date(i.datetime)));

  const roomIds = Array.from(new Set(files.map((i) => i.roomId)));
  // await batchCreateUsers(roomIds);

  interface ShowFileSet {
    roomid: number;
    start: number;
    end: number;
    files: File[];
  }
  const showFileSets: ShowFileSet[] = [];

  for (const roomId of roomIds) {
    if (roomId === 10101) continue;
    const fileList = files.filter((i) => i.roomId === roomId);
    fileList.sort((x, y) => x.datetime.getTime() - y.datetime.getTime());

    const determainDuration = Math.ceil(3600 * 1000 * 1.2);

    for (const file of fileList) {
      if (!file.id) {
        console.log(file);
        throw "no id";
      }
      const fileStart = file.datetime.getTime();
      let showFileSet = showFileSets.find(
        (i) =>
          i.roomid === file.roomId &&
          (Math.abs(i.start - fileStart) < determainDuration ||
            Math.abs(i.end - fileStart) < determainDuration)
      );

      if (!showFileSet) {
        showFileSet = {
          roomid: roomId,
          start: fileStart,
          end: fileStart,
          files: [],
        };
        showFileSets.push(showFileSet);
      }

      if (showFileSet.start > fileStart) showFileSet.start = fileStart;
      if (showFileSet.end < fileStart) showFileSet.end = fileStart;
      showFileSet.files.push(file);
    }
  }

  for (const showFileSet of showFileSets) {
    const danmaku_track: DanmakuClip[] = showFileSet.files
      .filter((i) => i.type === "danmaku")
      .sort((x, y) => x.datetime.getTime() - y.datetime.getTime())
      .map((i) => ({
        start_time: i.datetime,
        duration: 0,
        store: [i.id],
        remark: "",
      }));

    const video_track: VideoClip[] = [];

    for (const file of showFileSet.files) {
      if (file.type === "danmaku") continue;
      let clip = video_track.find(
        (c) => Math.abs(c.start_time.getTime() - file.datetime.getTime()) < 2000
      );

      if (!clip) {
        clip = {
          start_time: file.datetime,
          store: [],
          duration: 0,
          remark: "",
          thumbnail: [],
          origin: [],
          audio: [],
        };
        video_track.push(clip);
      }

      switch (file.type) {
        case "cover":
          clip.thumbnail.push(file.id);
          break;
        case "video":
          clip.store.push(file.id);
          break;
        case "raw_video":
          clip.origin.push(file.id);
          break;
        case "audio":
          clip.audio.push(file.id);
          break;
        default:
          console.log(file);
          break;
      }
    }

    video_track.sort((x, y) => x.start_time.getTime() - y.start_time.getTime());

    const show: Show = {
      remark: "",
      marks: [],
      video_track,
      start_time: new Date(showFileSet.start),
      area_id: 0,
      duration: 0,
      title: "",
      danmaku_track,
      room_id: showFileSet.roomid,
    };

    const apply_start = new Date().getTime();
    if (show.danmaku_track.find((i) => i.store.length === 0)) {
      console.log(JSON.stringify(show));
    }
    if (
      show.video_track.find(
        (i) =>
          i.store.length === 0 &&
          i.audio.length === 0 &&
          i.origin.length === 0 &&
          i.thumbnail.length === 0
      )
    ) {
      console.log(JSON.stringify(show));
    }
    await applyShow(show);
    if (new Date().getTime() - apply_start > 1000) {
      console.log(`${show.room_id}: ${show.start_time}`);
    }
  }
};

run();
