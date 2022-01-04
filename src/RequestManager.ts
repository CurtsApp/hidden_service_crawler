import { URL } from "./URL";

const http = require('http');
const https = require('https');

import { ActiveDogs, WatchDogManager } from "./WatchDog";
import { addPath } from "./webUtils";
const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');
const TOR_BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0";
const MAX_RETRY_CNT = 3;
const DATA_TIMEOUT_TIME = 31 * 1000; //31 seconds
const MAX_CONCURRENT_REQUESTS = 90; // Need to do benchmarks outside of the VM, seems inconsistent. 90 seems good for VM 120 gives worse results

enum UniqueStatus {
  DATA_TIMEOUT = -1
}

export class RequestManager {
  requestQueue: (() => void)[];
  activeRequests: URL[];
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

  private queuePageRequest(url: URL) {
    return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
      this.requestQueue.push(() => {
        this.getRequest(url).then((res) => resolve(res)).catch((e) => reject(e));
      });
    });
  }

  private clearActiveRequest(url: URL) {
    let startLength = this.activeRequests.length;
    this.activeRequests = this.activeRequests.filter((element) => element.getFull() !== url.getFull());
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
    console.log(`Active Requests: ${this.activeRequests.length}\nQueue Length: ${this.requestQueue.length}\nProcessed Requests: ${this.processedRequests}\nProcessed Requests / sec: ${(this.processedRequests/((Date.now() - this.startTime)/1000)).toFixed(2)}\nSuccessful Requests: ${this.successfulRequests}`);
  }

  private getRequest(url: URL, retryCount: number = 0) {
    return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
      // Active request gets cleared by onRequestComplete
      // Retried URLs are tracked by original URL
      if (retryCount === 0) {
        this.activeRequests.push(url);
      }

      // Debugging assertion
      if (this.activeRequests.length > MAX_CONCURRENT_REQUESTS || this.processedRequests > 999) {
        console.log(`${this.activeRequests}`);
        console.log(`Upcoming: ${url}`);
        console.log(new Error().stack);
        process.exit();
      }

      let request = new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
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
        const options = {
          headers: { 'User-Agent': TOR_BROWSER_USER_AGENT },
          agent
        };

        let webProtocol = url.protocol === "https" ? https : http;
        console.log(`Accessing ${url}`);
        webProtocol.get(url.getFull(), options, res => {
          WatchDogManager.feed(ActiveDogs.REQUESTS);
          switch (res.statusCode) {
            case 200:
              let wasDestroyed = false;
              let timeout = setTimeout(() => {
                // data taking too long to end. resolve early.
                // destroy should close the connection
                console.log(`Closing connection early: ${url.getFull()}`);
                wasDestroyed = true;
                res.destroy();
                resolve({ page: page, status: UniqueStatus.DATA_TIMEOUT });
              }, DATA_TIMEOUT_TIME);

              let page = '';
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

            case 303:
            // See other
            case 302:
            // Found. aka Moved temporarily but search engines shouldn't index the change (gonna index it anyways for now)
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
      });

      // Wrapper to ensure request complete always gets run
      request.then(res => {
        resolve(res);
      }).catch(e => reject(e)).finally(() => {
        // Only parent request tracks completion
        if (retryCount === 0)
          this.onRequestComplete(url)
      });
    });
  }
}