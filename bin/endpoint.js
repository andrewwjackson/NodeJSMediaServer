const s = require("./sql.js");
const http = require('http');
const readConfig = require('read-config');
const dateFormat = require('dateformat');
const numeral = require('numeral');
const crypto = require('crypto');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const config = readConfig('.\\config\\app.json');

let endpointconfigs = [];

config.endpoints.forEach(function (endpoint) {
  var key = config.server.ip.replace(/\./g, "") + endpoint.port.toString();
  endpointconfigs[key] = endpoint;
});

if (argv.ip === undefined || argv.port === undefined || argv.instance === undefined) {
  console.log('Missing required arguments! Stopping service.');
  console.dir(argv);
  process.send(endpointid + ':critical');
  process.exit(-1);
}

const endpointid = argv.instance;
const endpointconfig = endpointconfigs[endpointid];
const maxmem = numeral(endpointconfig.maxmem)._value;

function streamBuffer(res, req, buffer, contentType, modstring){
  if (buffer.length > 0) {    
    //normalize and convert date string
    modstring = modstring.toString().replace(/[\:\-]/, '');
    var modarr = modstring.split('');
    modarr.splice(4, 0, '-');
    modarr.splice(7, 0, '-');
    modarr.splice(13, 0, ':');
    modarr.splice(16, 0, ':');
    modstring = modarr.join('');
    var moddate = Date.parse(modstring);
    // ************************************ //
    var etag = crypto.createHash('md5').update(buffer.toString()).digest('hex');
    var nowutc = new Date().getTime();
    var expires = nowutc + (1000 * config.caching.maxage);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', (config.caching.cachability + ", max-age=" + config.caching.maxage.toString()));
    res.setHeader('expires', (dateFormat(expires, "ddd, dd mmm yyyy HH:MM:ss") + " GMT"));
    res.setHeader('last-modified', (dateFormat(moddate, "ddd, dd mmm yyyy HH:MM:ss") + " GMT"));
    res.setHeader('etag', etag);
    res.setHeader('Vary', config.caching.vary);
    res.end(buffer);
    buffer = [];
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    console.log("Not Found: " + req.url);
    res.end('Not Found');
    buffer = [];
  }
}

function doGarbageCollection() {
  //GC: check memory usage and recycle if needed
  if (process.memoryUsage().rss >= maxmem) {
    process.send(endpointid + ':recycle');
    process.exit();
  }
}

http.createServer(requestHandler).listen(argv.port, argv.ip);

process.send(endpointid + ':ready:' + process.pid);

function requestHandler(req, res) {
  if (endpointconfig) {
    if (endpointconfig.customheaders) {
      endpointconfig.customheaders.forEach(function (obj) {
        var keys = Object.keys(obj);
        keys.forEach(function (key) {
          res.setHeader(key, obj[key]);
        });
      });
    }
  }

  if (req.method !== 'GET') {
    process.send(endpointid + ':error');
    res.statusCode = 501;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Method not implemented');
  }

  var action = ((req.url.indexOf('?') === -1) ? req.url : req.url.substr(0, req.url.indexOf('?')));
  action = decodeURI(action);
  action = action.replace('/~/media', '');

  if (action.indexOf('.') === -1) {
    process.send(endpointid + ':error');
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    console.log("Forbidden request: " + req.url);
    return res.end('Forbidden');
  }

  
  var localpath = path.join(config.filesys.rootpath, action);
  fs.exists(localpath, function (exists) {
    if(fs.statSync(localpath).size >= maxmem) {
      doGarbageCollection();
      process.send(endpointid + ':error');
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      console.log("Server Error: " + req.url);
      return res.end('Internal Server Error');
    }
    if (exists) {
      let buffer = new Buffer.from([]);
      let modstring = '';
      let contentType = '';
      try {
        buffer = fs.readFileSync(localpath);
        modstring = fs.statSync(localpath).mtime;
        contentType = mime.contentType(localpath);      
      } catch {
        doGarbageCollection();
        process.send(endpointid + ':error');
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        console.log("Server Error: " + req.url);
        return res.end('Internal Server Error');
      }
      streamBuffer(res, req, buffer, contentType, modstring);
      doGarbageCollection();
      return;
    } else if (s.testConnection()) {
      //todo: add size check
      s.getMediaByPath(action, function (recordsets, err, sql) {
        if (err || recordsets === undefined) {
          console.log(err);
          if (sql) sql.close();
          process.send(endpointid + ':error');
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          console.log("Server Error: " + req.url);
          return res.end('Internal Server Error');
        }
        let buffer = new Buffer.from([]);
        let contentType = '';
        let modstring = '';
        recordsets.recordset.forEach(function (record) {
          let d = new Buffer.from(record.Data);
          buffer = Buffer.concat([buffer,d]);
          contentType = mime.contentType(record.MimeType);
          modstring = record.Updated;
        });
        if (sql) sql.close();
        streamBuffer(res, req, buffer, contentType, modstring);
        buffer = new Buffer.from([]);
        doGarbageCollection();
        return;
      });
    } else {
      streamBuffer(res, req, [], '', '');
      doGarbageCollection();
      return;
    }
  });
}