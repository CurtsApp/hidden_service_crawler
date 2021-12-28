// To get a new id restart tor service

import { Site } from "./Site";

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
  
  
  function main() {
    let testUrl = 'http://zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion/wiki/';
  
    let args = process.argv.slice(2);
    if (args.length > 0) {
      let startUrl = args[0];
      
      let argSite = new Site(startUrl, (finishedSite) => console.log(finishedSite));
      
    } else {
      console.log("Provide source url as first argument.");
    }
  }
  
  main();