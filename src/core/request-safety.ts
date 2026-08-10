export const safeRequestPath = (url: string | undefined): string => {
  if (!url) {
    return 'unknown';
  }

  const queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
};
