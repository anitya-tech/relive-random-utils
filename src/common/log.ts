import fs from "fs/promises";

export const getLogger = async (prefix: string, task_id: string) => {
  const infoFile = await fs.open(`logs/${prefix}-info.log`, "a");
  const info = (msg: string) => infoFile.appendFile(`${msg}\n`);

  const errorFile = await fs.open(`logs/${prefix}-error.log`, "a");
  const error = (msg: string) => errorFile.appendFile(`${msg}\n`);

  const headMessage = `
===========================================================
  Task ${task_id} start
  ${new Date().toString()}
===========================================================

`;

  await info(headMessage);
  await error(headMessage);

  return { info, error };
};
