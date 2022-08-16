import * as  fs from 'fs';
import * as  mime from 'mime-types';
import * as  path from 'path';
import * as  qs from 'querystring';
import numeral from 'numeral';
import readConfig from 'read-config-ng';
import mediadb from './sql.js';
import image from './image.js';

const i = new image();
const config = readConfig.sync('config/app.json');
const maxmem = numeral(config.server.maxmem)._value;

let request = class {

  requestHandler(req, res) {
    if (req.method !== 'GET') {
      res.statusCode = 501;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Method not implemented');
    }

    let action = ((req.url.indexOf('?') === -1) ? req.url : req.url.substr(0, req.url.indexOf('?')));
    action = decodeURI(action);
    action = action.replace(/.*?\/[\~\-]\/media\//, '');
    let query = qs.parse((req.url.indexOf('?') > -1 ? req.url.substr(req.url.indexOf('?')).length > 1 ? req.url.substr(req.url.indexOf('?') + 1) : '' : ''));
    let dbconfig = ((query.db !== undefined) ? config.sql.conn[query.db] !== undefined ? config.sql.conn[query.db.toLowerCase()] : config.sql.conn[config.sql.default.toLowerCase()] : config.sql.conn[config.sql.default.toLowerCase()]);
    action = action.split('?')[0];
    if (config.server.logToConsole) console.log(action);
    let guidtest = /^(\{*?[a-f0-9]{8}\-*?[a-f0-9]{4}\-*?[a-f0-9]{4}\-*?[a-f0-9]{4}\-*?[a-f0-9]{12}\}*?)\.*?/i;
    let mediaid = guidtest.test(action.split('.')[0]) ? action.split('.')[0].match(guidtest)[0] : '';

    if (action.indexOf('.') === -1) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      if (config.server.logToConsole) console.log("Forbidden request: " + req.url);
      return res.end('Forbidden');
    }

    let localpath = path.join(config.filesys.rootpath, action);
    fs.exists(localpath, function (exists) {
      if (exists && mediaid.length === 0 && config.server.fsEnabled === true) {
        if (config.server.logToConsole) console.log(`Found local file: ${localpath}`);
        if (fs.statSync(localpath).size >= maxmem) {
          if (config.server.logToConsole) console.log(`Local file too big: ${fs.statSync(localpath).size}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          if (config.server.logToConsole) console.log("Server Error: " + req.url);
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
          process.send(endpointid + ':error');
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          if (config.server.logToConsole) console.log("Server Error: " + req.url);
          return res.end('Internal Server Error');
        }
        i.imageProcessing(res, req, buffer, contentType, modstring);
        return;
      } else if (config.server.sqlEnabled === true) {
        const s = new mediadb(dbconfig);
        if (config.server.logToConsole) console.log(`Looking for ${(mediaid.length > 0 ? mediaid : action)} in MediaLibrary`);
        s.getMedia(action, maxmem, dbconfig, mediaid, function (recordsets, err, sql) {
          if (err || recordsets === undefined) {
            if (config.server.logToConsole) console.log(err);
            if (sql) sql.close();
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            if (config.server.logToConsole) console.log("Server Error: " + req.url);
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
              if (config.server.logToConsole) console.log(`Read ${d.length} byte chunk from db`);
              buffer = Buffer.concat([buffer, d]);
              if (config.server.logToConsole) console.log(`Buffer length is now ${buffer.length} total bytes`);
              contentType = mime.contentType(record.MimeType);
              modstring = record.Updated;
            } else {
              nulldata = true;
              blobsize = record.Size;
            }
          });
          if (sql) sql.close();
          if (nulldata === true) {
            if (config.server.logToConsole) console.log(`DB Blob too big (db source uses 2x memsize): ${blobsize}`);            
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            if (config.server.logToConsole) console.log("Server Error: " + req.url);
            return res.end('Internal Server Error');
          } else {
            if (config.server.logToConsole) console.log(`Read ${buffer.length} total bytes from db`);
            i.imageProcessing(res, req, buffer, contentType, modstring);
            buffer = new Buffer.from([]);

            return;
          }
        });
      } else {
        if (config.server.logToConsole) console.log('No data sources available');
        i.imageProcessing(res, req, [], '', '');

        return;
      }
    });
  }
}

export { request, request as default };