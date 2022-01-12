import { URL } from "./URL";

const http = require('http');
const https = require('https');
const zlib = require('zlib');

import { addPath, getCookieFromHeader, getCookieString } from "./webUtils";
const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');
const TOR_BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0";
const MAX_RETRY_CNT = 3;
const RETRY_DELAY_MIN = 1.5 * 1000; //1.5 sec 
const RETRY_VARIANCE = 1000;
const CONNECTION_TIMEOUT_TIME = 11 * 1000; //11 seconds
const DATA_TIMEOUT_TIME = 31 * 1000; //31 seconds
const MAX_CONCURRENT_REQUESTS = 60; // Need to do benchmarks outside of the VM, seems inconsistent. 90 seems good for VM 120 gives worse results

export enum UniqueStatus {
  GENERIC_FAILURE = -1,
  DATA_TIMEOUT = -2
}

export interface Cookie {
  key: string,
  value: string
}

interface PageResult {
  page: string,
  status: number
  setCookies?: Cookie[]
  redirectUrl?: URL
}

export class RequestManager {
  requestQueue: { [hostName: string]: (() => void)[] };
  activeRequests: { [hostName: string]: { url: URL, startTime: number } };
  processedRequests: number;
  successfulRequests: number;
  startTime: number;

  constructor() {
    this.requestQueue = {};
    this.activeRequests = {};
    this.processedRequests = 0;
    this.successfulRequests = 0;
    this.startTime = Date.now();
  }

  getPage(url: URL, cookies?: Cookie[]): Promise<PageResult> {
    // Each host is only have allowed to have one active request at a time
    if (Object.keys(this.activeRequests).length < MAX_CONCURRENT_REQUESTS && !this.activeRequests[url.hostName]) {
      console.log("Get from page");
      return this.getRequest(url, cookies);
    } else {
      return this.queuePageRequest(url, cookies);
    }
  }

  getActiveRequestString(): string {
    let s = "";
    let now = Date.now();
    Object.values(this.activeRequests).forEach((request) => {
      s += `${request.url} ${((now - request.startTime) / 1000).toFixed(1)}secs ago\n`;
    })
    return s;
  }

  isProcessing(): boolean {
    return Object.keys(this.activeRequests).length > 0 || Object.keys(this.requestQueue).length > 0;
  }

  private queuePageRequest(url: URL, cookies?: Cookie[], retryCount: number = 0) {
    return new Promise((resolve: (result: PageResult) => void, reject) => {
      let request = () => this.getRequest(url, cookies, retryCount).then((res) => resolve(res)).catch((e) => reject(e));
      // request queue keys are cleared if length == 0
      if (this.requestQueue[url.hostName]) {
        this.requestQueue[url.hostName].push(request);
      } else {
        this.requestQueue[url.hostName] = [request];
      }
    });
  }

  private clearActiveRequest(url: URL) {
    let startLength = Object.keys(this.activeRequests).length;
    delete this.activeRequests[url.hostName];
    if (startLength === Object.keys(this.activeRequests).length) {
      console.log(`Not found in active queue: ${url}`);
    }

  }
  // Called after every getRequest
  private onRequestComplete(url: URL) {
    this.clearActiveRequest(url);
    let queueKeys = Object.keys(this.requestQueue);
    if (queueKeys.length > 0) {
      let nextRequestHostName = null;
      let requestDelay = 0; //ms
      // Try to queue the same host name first
      if (url && this.requestQueue[url.hostName]) {
        nextRequestHostName = url.hostName;
        // Delay between 250ms - 750ms
        requestDelay = (Math.random() * 500) + 250;
      } else {
        let keyIndex = 0;
        // Don't queue an already active host name
        while (this.activeRequests[queueKeys[keyIndex]]) {
          keyIndex += 1;
        }
        nextRequestHostName = queueKeys[keyIndex];
      }

      // If no next request host name was available all hosts in queue are currently active. Don't start a new request
      if (nextRequestHostName) {
        // Remove the next request before running it to prevent running it twice
        let nextRequest = this.requestQueue[nextRequestHostName].shift();
        if (this.requestQueue[nextRequestHostName].length === 0) {
          delete this.requestQueue[nextRequestHostName];
        }
        // Execute the request
        if (requestDelay === 0) {
          nextRequest();
        } else {
          // Prevent additional active requests from being queued during the delay
          this.activeRequests[url.hostName] = { url, startTime: -1 };
          setTimeout(() => {
            nextRequest();
          }, requestDelay);
        }
      }
    }
    this.processedRequests += 1;
    if (this.processedRequests % 10 === 0) {
      console.log(`Active Requests: ${Object.keys(this.activeRequests).length}\nQueue Length: ${Object.keys(this.requestQueue).length}\nProcessed Requests: ${this.processedRequests}\nProcessed Requests / sec: ${(this.processedRequests / ((Date.now() - this.startTime) / 1000)).toFixed(2)}\nSuccessful Requests: ${((this.successfulRequests / this.processedRequests) * 100).toFixed(2)}%`);
    }
  }

  private getRequest(url: URL, cookies?: Cookie[], retryCount: number = 0) {
    return new Promise((resolve: (result: PageResult) => void, reject) => {
      // Active request gets cleared by onRequestComplete or retryRequest
      this.activeRequests[url.hostName] = { url, startTime: Date.now() };

      // Debugging assertion
      if (Object.keys(this.activeRequests).length > MAX_CONCURRENT_REQUESTS) {
        console.log(this.getActiveRequestString());
        console.log(`Upcoming: ${url}`);
        console.log(new Error().stack);
        process.exit();
      }

      let requestWrapper = new Promise((resolve: (result: PageResult) => void, reject) => {
        // On a retried request one http request has ended in a way that triggers a new request to be needed
        // Function is declared here to preserve this binding and access resolve/reject
        let retryRequest = (retryCount: number) => {
          setTimeout(() => {
            this.getRequest(url, cookies, retryCount + 1).then(res => {
              resolve(res);
            }).catch(e => reject(e));
          }, ((Math.random() * RETRY_VARIANCE) + RETRY_DELAY_MIN));
        };

        // Might have to swap between http and https if sites use https
        // Headers "Host" and "X-Amzn-Trace-Id" added automatically
        const headers = {
          'User-Agent': TOR_BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.5',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }

        if (cookies && cookies.length > 0) {
          // @ts-ignore
          headers.Cookie = getCookieString(cookies);
        }
        const options = {
          headers,
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
              let cookies = [];
              let cookieValues = res.headers['set-cookie'];
              if(cookieValues && cookieValues.length > 0 ) {
                cookieValues.forEach(value => cookies.push(getCookieFromHeader(value)));
              }
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
                    resolve({ page: Buffer.concat(buffer).toString(), status: res.statusCode, setCookies: cookies});
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
                      resolve({ page: bufOut.toString(), status: res.statusCode, setCookies: cookies });
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
                    resolve({ page: page, status: res.statusCode, setCookies: cookies });
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

              let locationURL = null;
              try {
                locationURL = new URL(res.headers.location);
              } catch {
                locationURL = new URL(addPath(url, res.headers.location));
              }

              console.log(`Redirectiong (${res.statusCode})...\nFrom: ${url}\nTo:   ${locationURL}`);
              resolve({ page: null, status: res.statusCode, redirectUrl: locationURL });
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
              retryRequest(retryCount);
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