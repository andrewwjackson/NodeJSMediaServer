import readConfig, { async } from 'read-config-ng';
import sql from 'mssql';

const config = readConfig.sync('config/app.json');

class pixeldb {
  sqlPool = null;

  constructor() {
    this.sqlPool = new sql.ConnectionPool(config.sql.conn.track);
  }

  async logPixel(pixelid, pixelname, pixelreferer, clientip, useragent, userid, impressionid) {
    if (config.server.logToConsole) console.log("Logging pixel request");
    this.sqlPool.connect().then(pool => {
      pool.request()
        .input('pixelid', sql.UniqueIdentifier, pixelid)
        .input('pixelname', sql.VarChar(25), pixelname)
        .input('pixelreferer', sql.VarChar(253), pixelreferer)
        .input('clientip', sql.VarChar(15), clientip)
        .input('useragent', sql.VarChar(sql.MAX), useragent)
        .input('userid', sql.VarChar(sql.MAX), userid)
        .input('impressionid', sql.VarChar(sql.MAX), impressionid)
        .execute('pixel_log');
    }).catch(err => {
      if (config.server.logToConsole) console.error(`Pixel Log Error: ${err}`);
    });
  }
}

export { pixeldb, pixeldb as default };