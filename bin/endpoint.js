const argv = require('minimist')(process.argv.slice(2));
const crypto = require('crypto');
const dateFormat = require('dateformat');
const fs = require('fs');
const http = require('http');
const imageSize = require('image-size');
const mime = require('mime-types');
const numeral = require('numeral');
const path = require('path');
const qs = require('querystring');
const readConfig = require('read-config');
const s = require("./sql.js");
const sharp = require('sharp');
const url = require('url');

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

function imageProcessing(res, req, buffer, contentType, modstring) { 
  if (buffer.length > 0) {
    var pathname = (url.parse(req.url, false).pathname);
    var extension = pathname.substr(pathname.lastIndexOf('.'));
    var query = url.parse(req.url, true).query;
    var outputBuffer = buffer;

    if (query.height || query.width || query.h || query.w || query.percent || query.pct || query.p || query.rotation || query.rot || query.r) {

      if ((([".png", ".jpg", ".jpeg", ".webp"]).includes(extension))) {
        var original = imageSize(buffer);
        var strHeight = query.height || query.h;
        var strWidth = query.width || query.w;
        var strPercent = query.percent || query.pct || query.p;
        var strRotation = query.rotation || query.rot || query.r;
        var height = Math.abs(isNaN(strHeight) ? original.height : strHeight);
        var width = Math.abs(isNaN(strWidth) ? original.width : strWidth);
        var percent = (isNaN(strPercent) ? 0 : (Math.abs(strPercent) / 100));
        var rotation = Math.abs((isNaN(strRotation)) ? 0 : strRotation);

        if (percent > 0) {
          width = Math.abs(original.width * percent);
          height = Math.abs(original.height * percent);
          console.log(width, height);
        } else if (height === original.height && width > 0) {
          height = Math.abs((width / original.width) * original.height);
        } else if (height > 0 && width === original.width) {
          width = Math.abs((height / original.height) * original.width);
        }

        if (rotation > 0 && height === original.height && width === original.width) {
          // rotation only request
          sharp(buffer).rotate(rotation, {background: {r: 255, g: 255, b: 255, alpha: 0.0}}).toBuffer().then(rotdata => {
            streamBuffer(res, req, rotdata, contentType, modstring);
          });
        } else if ((height !== original.height || width !== original.width) && height > 0 && width > 0) {
          sharp(buffer).resize(Math.round(width), Math.round(height), {background: {r: 255, g:0, b: 0, alpha: 0.0}}).toBuffer().then(data => {
            if (rotation > 0) {
              // rotation and resize
              sharp(data).rotate(rotation, {background: {r: 255, g: 255, b: 255, alpha: 0.0}}).toBuffer().then(rotdata => {
                streamBuffer(res, req, rotdata, contentType, modstring);
              });
            } else {
              // resize
              streamBuffer(res, req, data, contentType, modstring);
            }
          });
        } else {
          // nothing to do
          streamBuffer(res, req, buffer, contentType, modstring);
        }
      } else {
        console.log("not a qualifying file type...");
        streamBuffer(res, req, outputBuffer, contentType, modstring);
      }
    } else {
      console.log("no processing requested...");
      streamBuffer(res, req, outputBuffer, contentType, modstring);
    }
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
    console.log(`Not Found: ${req.url}\nBufferSize: ${buffer.length}`);    
    buffer = [];
  }
}

function streamBuffer(res, req, buffer, contentType, modstring) {
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
    console.log(`Not Found: ${req.url}\nBufferSize: ${buffer.length}`);
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
  action = action.replace(/.*?\/[\~\-]\/media\//, '');
  query = qs.parse((req.url.indexOf('?') > -1 ? req.url.substr(req.url.indexOf('?')).length > 1 ? req.url.substr(req.url.indexOf('?') + 1) : '' : ''));
  var dbconfig = ((query.db !== undefined) ? config.sql.conn[query.db] !== undefined ? config.sql.conn[query.db.toLowerCase()] : config.sql.conn[config.sql.default.toLowerCase()] : config.sql.conn[config.sql.default.toLowerCase()]);
  action = action.split('?')[0];  
  console.log(action);
  let guidtest = /^(\{*?[a-f0-9]{8}\-*?[a-f0-9]{4}\-*?[a-f0-9]{4}\-*?[a-f0-9]{4}\-*?[a-f0-9]{12}\}*?)\.*?/i;
  let mediaid = guidtest.test(action.split('.')[0]) ? action.split('.')[0].match(guidtest)[0] : '';

  if (action.indexOf('.') === -1) {
    process.send(endpointid + ':error');
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    console.log("Forbidden request: " + req.url);
    return res.end('Forbidden');
  }

  var localpath = path.join(config.filesys.rootpath, action);
  fs.exists(localpath, function (exists) {
    if (exists && mediaid.length === 0 && config.server.fsEnabled === true) {
      console.log(`Found local file: ${localpath}`);
      if (fs.statSync(localpath).size >= maxmem) {
        console.log(`Local file too big: ${fs.statSync(localpath).size}`);
        doGarbageCollection();
        process.send(endpointid + ':error');
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        console.log("Server Error: " + req.url);
        return res.end('Internal Server Error');
      }
      let buffer = new Buffer.from([]);
      let modstring = '';
      let contentType = '';
      try {
        buffer = fs.readFileSync(localpath);
        modstring = fs.statSync(localpath).mtime;
        contentType = mime.contentType(localpath);
      } catch (err) {
        doGarbageCollection();
        process.send(endpointid + ':error');
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        console.log("Server Error: " + req.url);
        return res.end('Internal Server Error');
      }
      imageProcessing(res, req, buffer, contentType, modstring);
      doGarbageCollection();
      return;
    } else if (config.server.sqlEnabled === true) {
      console.log(`Looking for ${(mediaid.length > 0 ? mediaid : action)} in MediaLibrary`);
      s.getMedia(action, maxmem, dbconfig, mediaid, function (recordsets, err, sql) {
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
        let blobsize = 0;
        let nulldata = false;
        recordsets.recordset.forEach(function (record) {
          if (record.Data !== null) {
            let d = new Buffer.from(record.Data);
            console.log(`Read ${d.length} byte chunk from db`);
            buffer = Buffer.concat([buffer, d]);
            console.log(`Buffer length is now ${buffer.length} total bytes`);
            contentType = mime.contentType(record.MimeType);
            modstring = record.Updated;
          } else {
            nulldata = true;
            blobsize = record.Size;
          }
        });
        if (sql) sql.close();
        if (nulldata === true) {
          console.log(`DB Blob too big (db source uses 2x memsize): ${blobsize}`);
          doGarbageCollection();
          process.send(endpointid + ':error');
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          console.log("Server Error: " + req.url);
          return res.end('Internal Server Error');
        } else {
          console.log(`Read ${buffer.length} total bytes from db`);
          imageProcessing(res, req, buffer, contentType, modstring);
          buffer = new Buffer.from([]);
          doGarbageCollection();
          return;
        }
      });
    } else {
      console.log('No data sources available');
      imageProcessing(res, req, [], '', '');
      doGarbageCollection();
      return;
    }
  });
}