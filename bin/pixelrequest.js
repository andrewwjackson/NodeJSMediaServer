import * as crypto from 'crypto';
import * as url from 'url';
import readConfig from 'read-config-ng';
import pixeldb from './pixelsql.js';
import image from './image.js';

const i = new image();
const config = readConfig.sync('config/app.json');

let pixelrequest = class {

  requestHandler(req, res) {
    
    let query = url.parse(req.url, true).query;
    let referer = req.headers?.referer;
    if(referer === undefined && query.debug === undefined) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      if (config.server.logToConsole) console.log("Pixel Request Forbidden: No Referer, No Debug ");
      return res.end('Forbidden');
    }
    
    let cookiename = (query.tp || config.server.defaultPixelCookie);
    let cookies = this.parseCookies(req);
    let pixelid = cookies[cookiename];

    if(cookies[cookiename] === undefined) {
      pixelid = crypto.randomUUID();
      if (config.server.logToConsole) console.log(`Setting cookie: ${cookiename}`);
      let cdom = ((config.server.pixelCookieDomain || "").length > 0 ? `Domain=${config.server.pixelCookieDomain};` : "");
      res.setHeader("Set-Cookie", `${cookiename}=${pixelid}; ${cdom} Path=/; Max-Age=315360000; Secure; HttpOnly; SameSite=None`)
    }
    
    let iparr = this.getIpArray(req);
    let clientip = (iparr.length > 0 ? iparr[0] : "0.0.0.0");
    let useragent = (req.headers["user-agent"] || "unknown");
    let userid = (query.uid || "");
    let impressionid = (query.iid || "");
    
    const pix = new pixeldb();
    pix.logPixel(
      pixelid,
      cookiename,
      (referer || "debug"),
      clientip,
      useragent,
      userid,
      impressionid
    )
    
    i.pixel(res, req);
  }

  parseCookies (req) {
    const list = {};
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function(cookie) {
        let [ name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
  }

  getIpArray(req) {
      let headers = req.headers;
      let arr = [];
      let ipstring = (headers["x-forwarded-for"]);
      if(ipstring === undefined) {
        return arr;
      }
      ipstring.split(",").forEach(ip=>arr.push(ip.split(":")[0]));
      
      return arr;
  }

}

export { pixelrequest, pixelrequest as default };