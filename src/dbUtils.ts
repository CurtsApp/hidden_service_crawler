import { LinksRow } from "./DBManager";
import { URL } from "./URL";


function getUrlFromComponents(isSecure: boolean, hostname: string, path: string) {
    return new URL(`${isSecure ? "https" : "http"}://${hostname}.onion${path}`);
}
export function getUrlsFromLinkRow(row: LinksRow) {
    return {
        from: getUrlFromComponents(row.fromProtcolIsSecure === 1, row.fromHostname, row.fromPath),
        to: getUrlFromComponents(row.toProtcolIsSecure === 1, row.toHostname, row.toPath)
    }
}