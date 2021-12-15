export type FileType = "audio" | "raw_video" | "video" | "danmaku" | "cover";

export interface FileMeta {
  key: string;
  roomId: number;
  datetime: Date | string;
  size: number;
  type: FileType;
  ext: string;
  md5?: string;
}

export const fileTypeMap: Record<string, FileType> = {
  xml: "danmaku",
  mp3: "audio",
  mp4: "video",
  flv: "raw_video",
  jpg: "cover",
  png: "cover",
};

export const parseDateTime = (date: string, time: string): Date => {
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
