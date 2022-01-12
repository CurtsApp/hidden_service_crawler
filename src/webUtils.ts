import { Cookie } from "./RequestManager";
import { URL } from "./URL";

export const VALID_ONION_REGEX = '(http:\\/\\/|https:\\/\\/)?[a-zA-Z0-9@:%_+~#?&=]{10,256}\\.onion[a-zA-Z0-9@:%_+~#?&=/.]*';

export function addPath(url: URL, path: string) {
  if (path[0] !== "/") {
    path = `/${path}`;
  }
  return `${url.protocol}://${url.hostName}.onion${path}`;
}

export function getPageLinks(pageString) {
  let getOnionsRegEx = new RegExp(VALID_ONION_REGEX, 'g');

  let matches = [];
  let match = getOnionsRegEx.exec(pageString);
  while (match != null) {
    matches.push(match[0]);
    match = getOnionsRegEx.exec(pageString);
  }

  return matches;
}

export function getPageTitle(pageString) {
  let getTitleRegEx = new RegExp('<[tT][iI][tT][lL][eE]>.*<\/[tT][iI][tT][lL][eE]>');

  let match = getTitleRegEx.exec(pageString);
  if (match !== null) {
    let matchString = match[0];
    matchString = matchString.slice(7, -8);
    return matchString;
  }
  return null;
}

export function getPageRefreshTimer(pageString): number {
  // ex. looking for <meta http-equiv="refresh" content="300">
  let getRefreshRegEx = new RegExp('<meta http-equiv="refresh" content=".*">');

  let match = getRefreshRegEx.exec(pageString);
  if (match !== null) {
    let matchString = match[0].split(">")[0];
    matchString = matchString.slice(0, -1);
    matchString = matchString.slice(36);
    let refreshDelay = parseInt(matchString);
    if (!isNaN(refreshDelay)) {
      return refreshDelay;
    }
  }

  return null;
}

export function getCookieString(cookies: Cookie[]): string {
  let s = "";
  cookies.forEach((cookie, i) => {
    s += `${i === 0 ? "" : "; "}${cookie.key}:${cookie.value}`;
  });
  return s;
}

export function getCookieFromHeader(headerValue: string): Cookie {
  // ex. dcap=02B10D38AFEC69027A9DF244C7C7B82E27E4781499D14F95BA9B83D2F02BA97403DD4C010E6B224D3A17FA49CAC771757C0B32BFAFD393FB1740C57FDB10EBA7; Max-Age=120; Domain=dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion; Path=/; HttpOnly; SameSite=Lax
  let pieces = headerValue.split(";");
  pieces = pieces[0].split("=");
  return {
    key: pieces[0].trim(),
    value: pieces[1].trim()
  };
}