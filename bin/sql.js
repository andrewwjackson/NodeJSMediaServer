import readConfig, { async } from 'read-config-ng';
import sql from 'mssql';

const config = readConfig.sync('config/app.json');

let mediadb = class {
  sqlPool = null;

  constructor(dbConfig) {
    this.sqlPool = new sql.ConnectionPool(dbConfig);
  }

  getMedia(path, maxmem, dbconfig, mediaid, callback) {
    this.sqlPool.connect().then(pool => {
      pool.request()
        .input('input', sql.VarChar((mediaid.length > 0 ? 38 : 4000)), (mediaid.length > 0 ? mediaid : path))
        .input('maxsize', sql.Int, maxmem)
        .execute((mediaid.length > 0 ? 'SitecoreGetMediaByID' : 'SitecoreGetMediaByPath')).then(callback);
    }).catch(err => {
      return callback(undefined, err, sql);
    });
  }  
}

export { mediadb, mediadb as default };