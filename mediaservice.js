import * as http from 'http';
import * as logger from './bin/logger.js';
import got from 'got';
import readConfig from 'read-config-ng';
import * as child_process from 'child_process';
const fork = child_process.fork;

const config = readConfig.sync('.\\config\\app.json');
const startts = new Date();

let endpointkeys = [];
let endpoints = [];
let reqcnt = 0;
let errcnt = 0;
let nfcnt = 0;
let cur = 0;

if(config.endpoints.length < 1) {
  console.log('No endpoints configured! Stopping service.');
  process.exit(-1);
}
//init logger
let thelogger = logger.default;

//spawn endpoints
config.endpoints.forEach(function(endpoint){
  let key = config.server.ip.replace(/\./g, "") + endpoint.port.toString();  
  let ep = fork('.\\bin\\endpoint.js',[('--ip='+config.server.ip),('--port='+endpoint.port), ('--instance=' + key) ]);
  ep.on('message', processMessage);
  endpoints[key] = endpoint;
  endpointkeys.push(key);
});

function processMessage(msg){
  // message anatomy endpointid:[ready|recycle|error|notfound|critical]:args
  let msgarr = msg.split(":");
  if(msgarr.length < 2) return; //could do some error logging here.
  let endpointid = msgarr[0];
  let message = msgarr[1].toLowerCase();
  switch(message) {
    case 'ready':
      let pid = ((msgarr.length > 2) ? msgarr[2] : 0);
      endpoints[endpointid].enabled = true;
      console.log("Spawned endpoint node @ PID: " + pid.toString() + " Host: " + config.server.ip + ":" + endpoints[endpointid].port);
      break;
    case 'recycle':
      endpoints[endpointid].enabled = false;
      let ep = fork('.\\bin\\endpoint.js',[('--ip='+config.server.ip),('--port='+endpoints[endpointid].port), ('--instance=' + endpointid) ]);
      ep.on('message', processMessage);
      break;
    case 'error':
      errcnt ++;
      break;
    case 'notfound':
      nfcnt ++;
      break;
    case 'critical':
      errcnt++;
      endpoints[endpointid].enabled = false;
      break;
    default:
     return;
  }
}

const server = http.createServer(requestHandler).listen(config.server.port, config.server.ip, ()=>{
  console.log((server.listening ? "listening" : "error!"));
});


function endpointCheck() {
  let foo = 0;
  endpointkeys.forEach( function(k) {
    if(endpoints[k].enabled === true) foo ++;
  });
  return foo;
}

function handleRequest(req, res) {
  console.log('Recieved request');
  config.server.customheaders.forEach(function(obj){
    let keys = Object.keys(obj);
    keys.forEach(function(key){
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
  action = action.replace('/~/media','');

  if(action.substr(1).toLowerCase() === '!status' ){
    let n = Math.round(new Date()/1000);
    let x = Math.round(startts / 1000);
    let ut = n - x;
    let stats = {
      lastrestart: new Date(startts).toGMTString(),
      uptime: ut,
      epcount: config.endpoints.length,
      eponline: endpointCheck(),
      reqcount: reqcnt,
      errcount: errcnt,
      nfcount: nfcnt
    };
    let statsstring = JSON.stringify(stats);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(statsstring);
  }

  reqcnt ++;

  if(endpointCheck() === 0) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');;
    return res.end('Server Error: No endpoint available.');
  }

  if(action.indexOf('.') === -1){
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  let epkey = endpointkeys[cur];
  let ep = endpoints[epkey];

  if(!ep.enabled === true) {
    cur = (cur + 1) % endpointkeys.length;
    return requestHandler(req,res);
  }

  let furl = ("http://" + host + ":" + ep.port + req.url);
  (async () => {      
  })();
  
  got(furl).then(_req => {
    Object.getOwnPropertyNames(_req.headers).forEach((prop) => {
      let headerval = _req.headers[prop];
      if(headerval!== undefined && headerval !== null){
        res.setHeader(prop, headerval);
      }      
    });
    
    res.end(_req.rawBody);
    cur = (cur + 1) % endpointkeys.length;
  }).catch( error => {
    res.statusCode = 500;
    return res.end('Server Error');
  });
}

function requestHandler(req, res) {
  if(config.server.loggingEnabled===true ) { 
    thelogger(req, res, function() {
      handleRequest(req, res);
    });
  } else {
    handleRequest(req, res);
  }  
}