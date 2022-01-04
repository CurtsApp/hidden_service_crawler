import { URL } from "./URL";

const http = require('http');
const https = require('https');
const zlib = require('zlib');

import { ActiveDogs, WatchDogManager } from "./WatchDog";
import { addPath } from "./webUtils";
const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');
const TOR_BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0";
const MAX_RETRY_CNT = 3;
const CONNECTION_TIMEOUT_TIME = 11 * 1000; //11 seconds
const DATA_TIMEOUT_TIME = 31 * 1000; //31 seconds
const MAX_CONCURRENT_REQUESTS = 90; // Need to do benchmarks outside of the VM, seems inconsistent. 90 seems good for VM 120 gives worse results

export enum UniqueStatus {
  GENERIC_FAILURE = -1,
  DATA_TIMEOUT = -2
}

export class RequestManager {
  requestQueue: (() => void)[];
  activeRequests: {url: URL, startTime: number}[];
  processedRequests: number;
  successfulRequests: number;
  startTime: number;

  constructor() {
    this.requestQueue = [];
    this.activeRequests = [];
    this.processedRequests = 0;
    this.successfulRequests = 0;
    this.startTime = Date.now();
  }

  getPage(url: URL) {
    if (this.activeRequests.length < MAX_CONCURRENT_REQUESTS) {
      return this.getRequest(url);
    } else {
      return this.queuePageRequest(url);
    }
  }

  getActiveRequestString(): string {
    let s = "";
    let now = Date.now();
    this.activeRequests.map(request => s += `${request.url} ${((now - request.startTime) / 1000).toFixed(1)}secs ago\n`)
    return s;
  }

  private queuePageRequest(url: URL) {
    return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
      this.requestQueue.push(() => {
        this.getRequest(url).then((res) => resolve(res)).catch((e) => reject(e));
      });
    });
  }

  private clearActiveRequest(url: URL) {
    let startLength = this.activeRequests.length;
    this.activeRequests = this.activeRequests.filter((element) => element.url.getFull() !== url.getFull());
    if (startLength === this.activeRequests.length) {
      console.log(`Not found in active queue: ${url}`);
    }

  }
  // Called after every getRequest
  private onRequestComplete(url: URL) {
    this.clearActiveRequest(url);
    if (this.requestQueue.length > 0) {
      // Remove the next request before running it to prevent running it twice
      let nextRequest = this.requestQueue.shift();
      // Execute the request
      nextRequest();
    }
    this.processedRequests += 1;
    if (this.processedRequests % 10 === 0) {
      console.log(`Active Requests: ${this.activeRequests.length}\nQueue Length: ${this.requestQueue.length}\nProcessed Requests: ${this.processedRequests}\nProcessed Requests / sec: ${(this.processedRequests / ((Date.now() - this.startTime) / 1000)).toFixed(2)}\nSuccessful Requests: ${((this.successfulRequests / this.processedRequests) * 100).toFixed(2)}%`);
    }
  }

  private getRequest(url: URL, retryCount: number = 0) {
    return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
      // Active request gets cleared by onRequestComplete
      // Retried URLs are tracked by original URL
      if (retryCount === 0) {
        this.activeRequests.push({url, startTime: Date.now()});
      }

      // Debugging assertion
      if (this.activeRequests.length > MAX_CONCURRENT_REQUESTS) {
        console.log(this.getActiveRequestString());
        console.log(`Upcoming: ${url}`);
        console.log(new Error().stack);
        process.exit();
      }

      let requestWrapper = new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
        // On a retried request one http request has ended in a way that triggers a new request to be needed
        // Function is declared here to preserve this binding and access resolve/reject
        let retryRequest = (retryURL: URL, retryCount: number) => {
          // Clear previously requested URL not new one
          //this.clearActiveRequest(url);
          this.getRequest(retryURL, retryCount + 1).then(res => {
            resolve(res);
          }).catch(e => reject(e));
        };

        // Might have to swap between http and https if sites use https
        // Headers "Host" and "X-Amzn-Trace-Id" added automatically
        const options = {
          headers: {
            'User-Agent': TOR_BROWSER_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.5',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          },
          agent
        };

        let webProtocol = url.protocol === "https" ? https : http;
        console.log(`Accessing ${url}`);
        let request = webProtocol.get(url.getFull(), options, res => {
          //WatchDogManager.feed(ActiveDogs.REQUESTS);
          let encodingType = res.headers['content-encoding'];
          switch (res.statusCode) {
            case 200:
              let wasDestroyed = false;
              let timeout = setTimeout(() => {
                // data taking too long to end. resolve early.
                // destroy should close the connection
                console.log(`Closing connection early: ${url.getFull()}`);
                wasDestroyed = true;
                res.destroy();
                let partialPage = "";

                switch (encodingType) {
                  case "gzip":
                    partialPage = Buffer.concat(buffer).toString();
                    resolve({ page: partialPage, status: UniqueStatus.DATA_TIMEOUT });
                    break;
                  case "br":
                    zlib.brotliDecompress(Buffer.concat(buffer), (err, bufOut) => {
                      resolve({ page: bufOut.toString(), status: UniqueStatus.DATA_TIMEOUT });
                    });
                    break;
                  default:
                    partialPage = page;
                    resolve({ page: partialPage, status: UniqueStatus.DATA_TIMEOUT });
                    break;
                }
              }, DATA_TIMEOUT_TIME);

              let page = '';
              let buffer = [];
              switch (encodingType) {
                case 'gzip':
                  res.pipe(zlib.createGunzip()).on('data', (chunk) => {
                    buffer.push(chunk);
                  }).on('end', () => {
                    if (wasDestroyed) {
                      return;
                    }
                    clearTimeout(timeout);
                    this.successfulRequests += 1;
                    resolve({ page: Buffer.concat(buffer).toString(), status: res.statusCode });
                  });
                  break;

                case 'br':
                  res.on('data', (chunk) => {
                    buffer.push(chunk);
                  }).on('end', () => {
                    if (wasDestroyed) {
                      return;
                    }
                    clearTimeout(timeout);
                    this.successfulRequests += 1;
                    zlib.brotliDecompress(Buffer.concat(buffer), (err, bufOut) => {
                      resolve({ page: bufOut.toString(), status: res.statusCode });
                    });

                  });
                  break;

                case undefined:
                  res.on('data', (data) => {
                    page += data;
                  });
                  res.on('end', () => {
                    if (wasDestroyed) {
                      return;
                    }
                    clearTimeout(timeout);
                    this.successfulRequests += 1;
                    resolve({ page: page, status: res.statusCode });
                  });
                  break;
                default:
                  throw new Error(`Unexpected encodingtype ${encodingType}`);
              }
              break;

            case 303:
            // See other
            case 302:
            // Found. aka Moved temporarily but search engines shouldn't index the change (gonna index it anyways for now)
            case 308:
            // Permanent redirect
            case 307:
            // Moved temporarily
            case 301:
              // Moved permanetly
              if (retryCount > MAX_RETRY_CNT) {
                console.log(`Max redirect count reacted for: ${url}`);
                resolve({ page: null, status: res.statusCode });
                return;
              }
              let locationURL = null;
              try {
                locationURL = new URL(res.headers.location);
              } catch {
                locationURL = new URL(addPath(url, res.headers.location));
              }

              console.log(`Redirectiong (${res.statusCode})...\nFrom: ${url}\nTo:   ${locationURL}`);
              retryRequest(locationURL, retryCount);
              break;

            case 300:
            // Multiple choices (there should be location information in a payload somewhere). Currently unhandled
            case 500:
            // Internal Server Error
            case 503:
            // Retry later (should be time in headers)
            case 520:
            // Cloud flare had an unexpected issue
            case 420:
            // "Enchance your Calm" might be rate limited
            case 429:
            // Too many requests
            // TODO slow down requests to the same host but unique paths or maybe try again in a bit
            case 403:
            // Forbidden
            case 400:
            // Bad Request 
            case 401:
            // Unauthorized
            case 405:
            // Method not allowed
            case 418:
            // I'm a little teapot (The site knows we are a bot and won't respond)
            case 404:
              // Not found
              resolve({ page: null, status: res.statusCode });
              break;
            case 502:
            // Bad gateway
            case 504:
            // Gateway timeout
            case 408:
              // Connection timeout
              if (retryCount > MAX_RETRY_CNT) {
                console.log(`Max retry count after timeout reacted for: ${url}`)
                resolve({ page: null, status: res.statusCode });
                return;
              }
              // Retry getting the same data
              retryRequest(url, retryCount);
              break;

            default:
              throw new Error(`New status code: ${res.statusCode}. From \n${url}\nHeaders:\n${JSON.stringify(res.headers)}`);
          }
        }).on('error', error => {
          reject(error);
        });

        request.setTimeout(CONNECTION_TIMEOUT_TIME, () => {
          console.log(`No response from: ${url}`);
          request.abort();
        })
      });

      // Wrapper to ensure request complete always gets run
      requestWrapper.then(res => {
        resolve(res);
      }).catch(e => reject(e)).finally(() => {
        // Only parent request tracks completion
        if (retryCount === 0)
          this.onRequestComplete(url)
      });
    });
  }
}