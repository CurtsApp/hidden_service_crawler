import { LinksRow } from "./DBManager";
import { URL } from "./URL";


export function getUrlFromComponents(components: urlComponents) {
    const { isSecure, hostname, path } = components;
    return new URL(`${isSecure === 1 ? "https" : "http"}://${hostname}.onion${path}`);
}

interface urlComponents {
    isSecure: 1 | 0;
    hostname: string;
    path: string
}

export function getComponentsFromUrl(url: URL): urlComponents {
    return {
        isSecure: url.protocol === "https" ? 1 : 0,
        hostname: url.hostName,
        path: url.getSuffix()
    }
}

export interface Link {
    from: URL;
    to: URL;
}

export function getUrlsFromLinkRow(row: LinksRow): Link {
    return {
        from: getUrlFromComponents({
            isSecure: row.from_protocol_is_secure,
            hostname: row.from_hostname,
            path: row.from_path
        }),
        to: getUrlFromComponents({
            isSecure: row.to_protocol_is_secure,
            hostname: row.to_hostname,
            path: row.to_path
        })
    }
}