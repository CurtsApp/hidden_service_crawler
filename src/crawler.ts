const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

function getPage(url) {
  const http = require('http');

  return new Promise((resolve, reject) => {
    // Might have to swap between http and https if sites use https
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0' },
      agent
    };

    http.get(url, options, res => {
      let page = '';
      res.on('data', (data) => {
        page += data;
      });

      res.on('end', () => {
        resolve(page);
      });
    }).on('error', error => {
      reject(error)
    });
  });
}

function printPage(url) {
  getPage(url).then(page => console.log(page)).catch(e => console.log(e));
}

function getLinks(pageString) {
  let getOnionsRegEx = new RegExp('[a-zA-Z0-9@:%_+~#?&=]{10,256}.onion[a-zA-Z0-9@:%_+~#?&=/.]*', 'g');

  let matches = [];
  let match = getOnionsRegEx.exec(pageString);
  while (match != null) {
    matches.push(match[0]);
    match = getOnionsRegEx.exec(pageString);
  }

  return matches;
}

function getTitle(pageString) {
  let getTitleRegEx = new RegExp('<[tT][iI][tT][lL][eE]>.*<\/[tT][iI][tT][lL][eE]>');

  let match = getTitleRegEx.exec(pageString);
  if (match != null) {
    let matchString = match[0];
    matchString = matchString.slice(7, -8);
    return matchString;
  }
  return null;
}

// To get a new id restart tor service
// sudo service tor restart
function newID() {
  const {
    spawn
  } = require('child_process');

  const idProc = spawn('python3', ['new_id.py']);
  let procMsg = '';
  idProc.stdout.on('data', (data) => {
    procMsg += data;
  });

  idProc.on('close', (code) => {
    console.log(procMsg);
    console.log('ID Reset');
  })
}

interface Site {
  url: string,
  title: string,
  depth: number,
  links: string[]
}

function main() {
  let testUrl = 'http://zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion/wiki/';

  let args = process.argv.slice(2);
  if (args.length > 0) {
    let startUrl = args[0];
    getPage(startUrl).then(page => {
      getLinks(page).forEach(link => console.log(link))
    }).catch(e => console.log(e));
    getPage(args[0]).then(page => console.log(getTitle(page))).catch(e => console.log(e));
  } else {
    console.log("Provide source url as first argument.");
  }
}

main();

