import * as http from 'http';
import request from './bin/request.js';
import readConfig from 'read-config-ng';

const r = new request();
const config = readConfig.sync('config/app.json');
const startts = new Date();

let reqcnt = 0;
let errcnt = 0;
let nfcnt = 0;

const server = http.createServer(requestHandler).listen(config.server.port, () => {
  if (config.server.logToConsole) console.log((server.listening ? `listening: ${server.address().address}:${server.address().port}` : "error!"));
});

function requestHandler(req, res) {
  if (config.server.logToConsole) console.log('Recieved request');
  config.server.customheaders.forEach(function (obj) {
    let keys = Object.keys(obj);
    keys.forEach(function (key) {
      res.setHeader(key, obj[key]);
    });
  });

  if (req.method !== 'GET') {
    res.statusCode = 501;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Method not implemented');
  }

  let host = ((req.headers.host.indexOf(':') === -1) ? req.headers.host : req.headers.host.substr(0, req.headers.host.indexOf(':')));
  let action = ((req.url.indexOf('?') === -1) ? req.url : req.url.substr(0, req.url.indexOf('?')));
  action = action.replace('/~/media', '');

  if (action.substr(1).toLowerCase() === 'balancecheck') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');    
    return res.end("UP");
  }

  if (action.substr(1).toLowerCase() === '!status') {
    let n = Math.round(new Date() / 1000);
    let x = Math.round(startts / 1000);
    let ut = n - x;
    let stats = {
      lastrestart: new Date(startts).toGMTString(),
      uptime: ut,
      reqcount: reqcnt,
      errcount: errcnt,
      nfcount: nfcnt
    };
    let statsstring = JSON.stringify(stats);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(statsstring);
  }

  reqcnt++;

  if (action.indexOf('.') === -1) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  r.requestHandler(req, res);
} 
