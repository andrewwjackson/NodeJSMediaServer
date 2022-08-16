import * as  crypto from 'crypto';
import dateFormat from 'dateformat';
import readConfig from 'read-config-ng';

const config = readConfig.sync('config/app.json');

let stream = class {
  streamBuffer(res, req, buffer, contentType, modstring) {
    if (buffer.length > 0) {
      //normalize and convert date string
      modstring = modstring.toString().replace(/[\:\-]/, '');
      let modarr = modstring.split('');
      modarr.splice(4, 0, '-');
      modarr.splice(7, 0, '-');
      modarr.splice(13, 0, ':');
      modarr.splice(16, 0, ':');
      modstring = modarr.join('');
      let moddate = Date.parse(modstring);
      // ************************************ //

      // look for type specific cache rules
      let cachesettings = config.caching[contentType.split(';')[0]];
      if (cachesettings === undefined || cachesettings === null) cachesettings = config.caching.default;

      let etag = crypto.createHash('md5').update(buffer.toString()).digest('hex');
      let nowutc = new Date().getTime();
      let expires = nowutc + (1000 * cachesettings.maxage);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length)
      res.setHeader('Cache-Control', (cachesettings.cachability + ", max-age=" + cachesettings.maxage.toString()));
      res.setHeader('expires', (dateFormat(expires, "ddd, dd mmm yyyy HH:MM:ss") + " GMT"));
      res.setHeader('last-modified', (dateFormat(moddate, "ddd, dd mmm yyyy HH:MM:ss") + " GMT"));
      res.setHeader('etag', etag);
      res.setHeader('Vary', cachesettings.vary);
      res.end(buffer);
      buffer = [];
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      if (config.server.logToConsole) console.log(`Not Found: ${req.url}\nBufferSize: ${buffer.length}`);
      res.end('Not Found');
      buffer = [];
    }
  }
}

export { stream, stream as default };