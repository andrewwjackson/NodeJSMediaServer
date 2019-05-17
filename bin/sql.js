const sql = require('mssql');
const readConfig = require('read-config');

var config = readConfig('.\\config\\app.json');
var dbconfigDefault = config.sql.conn["web"];

exports.testConnection = function(){
  testConnection();
}

exports.getMedia = function(path, maxmem, dbconfig, mediaid, callback){
  getMedia(path, maxmem, dbconfig, mediaid, callback);
}

exports.testGetMediaByPath = function(){
  getMediaByPath('/files/bigfile.rar', testcallback);
}

function getMedia(path, maxmem, dbconfig, mediaid, callback){  
  new sql.ConnectionPool(dbconfig).connect().then(pool => {     
    pool.request()
    .input('input', sql.VarChar((mediaid.length > 0 ? 38 : 4000)), (mediaid.length > 0 ? mediaid : path))
    .input('maxsize', sql.Int, maxmem)
    .execute((mediaid.length > 0 ? 'SitecoreGetMediaByID' : 'SitecoreGetMediaByPath')).then(callback);    
  }).catch(err => {    
    return callback(undefined, err, sql);
  });;
}

function testConnection(){
  try {
    sql.connect(dbconfigDefault, function (err) {
      if (err){
        console.log(err); 
        return false;
      }
      var request = new sql.Request();
      request.query('SELECT TOP 1 name FROM Items', function(err, recordset){
        if (err){
          console.log(err); 
          return false;
        }
        return (recordset.rowsAffected[0] > 0);
      });
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

function testcallback(recordsets){  
  var arr = [];
  recordsets.recordset.forEach(function(record){        
    arr.push(record.Data);
  });
  var buffer = Buffer.concat(arr);
  console.log(buffer.length);
}