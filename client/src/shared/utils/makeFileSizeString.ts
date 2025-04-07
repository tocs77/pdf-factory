export const makeFileSizeString = (bytes: number, si = false, dp = 1) => {
  if (bytes === 0) return '0b';
  if (!bytes) return '';
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return `${bytes} B`;
  }

  //const units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  const units = ['КБ', 'MБ', 'ГБ', 'TБ', 'ПБ', 'ЭБ', 'ЗБ', 'ЙБ'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  return `${bytes.toFixed(dp)} ${units[u]}`;
};
