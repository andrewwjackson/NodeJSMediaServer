const sql = require('mssql');
const readConfig = require('read-config');

var config = readConfig('.\\config\\app.json');
var dbconfig = config.sql;

exports.testConnection = function(){
  testConnection();
}

exports.getMediaByPath = function(path, callback){
  getMediaByPath(path, callback);
}

exports.testGetMediaByPath = function(){
  getMediaByPath('/files/bigfile.rar', testcallback);
}

//todo: add size check
function getMediaByPath(path, callback){  
  new sql.ConnectionPool(dbconfig).connect().then(pool => {     
    pool.request()
    .input('testpath', sql.VarChar(4000), path)
    .execute('SitecoreGetMediaByPath').then(callback);    
  }).catch(err => {    
    return callback(undefined, err, sql);
  });;
}

function testConnection(){
  try {
    sql.connect(dbconfig, function (err) {
      if (err){ 
          return false;
        }
      var request = new sql.Request();
      request.query('SELECT TOP 1 name FROM Items', function(err, recordset){
        if (err){ 
          return false;
        }
        return (recordset.rowsAffected[0] > 0);
      });
    });
  } catch {
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