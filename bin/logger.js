const onHeaders = require('on-headers');
const onFinished = require('on-finished');
const readConfig = require('read-config');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const config = readConfig('.\\config\\app.json');
var options = config.server.logging,
logformat, todayDate = String(),
currentDate;

module.exports = app;

function app() {
	validateOptions(options);

	return function (req, res, callback) {		
		mkdirp(options.directory, function(err){if(err){ console.error(err); throw err}});
		currentDate = new Date();
		function logRequest() {
			logformat = ':date :host :port :url :qs :method :ip :xff :statusCode :response-time\n';
			logformat = logformat.replace(':method', req.method);
			logformat = logformat.replace(':host', getHost(req));
			logformat = logformat.replace(':port', getPort(req));
			logformat = logformat.replace(':ip', req.connection.remoteAddress);
			logformat = logformat.replace(':xff', getXff(req));
			logformat = logformat.replace(':url', getUrl(req));
      logformat = logformat.replace(':qs', getQs(req));
			logformat = logformat.replace(':statusCode', res.statusCode);
			logformat = logformat.replace(':date', formatDate(new Date()));
			logformat = logformat.replace(':response-time', responseTime(res));
			fs.appendFile(path.join(options.directory, options.file), logformat, 'utf8', function (err) {
				if (err) { console.log(err); throw err; }
			});
		}
		onHeaders(res, logTime);
		onFinished(res, logRequest);
		callback();
	}
}

function validateOptions(opt) {
	if (opt) {
    if (opt.hasOwnProperty(' file ')) {
        if ((opt.file.length < 1 || typeof opt.file !== ' string ')) {
            throw new TypeError(' file value must be a valid string ');
        }
        if (!isValidFileName(opt.file)) {
            throw new TypeError(' only underscore is allowed in file name ');
        }
        options.file = opt.file || options.file;
    }
  }

  //format file name
  var d = new Date();
  todayDate = todayDate.concat(d.getFullYear(), pad((d.getMonth() + 1), 1) , pad(d.getDate(), 1) );
  if (options.file.indexOf('.log') === -1) {
      options.file = String().concat(options.file, '_', todayDate, '.log');
  } else {
      options.file = String().concat(options.file, '_', todayDate);
  }

  return options;
}

function logTime() {
  if (typeof this.setHeader === 'function') return this.setHeader('X-Response-Time', new Date - currentDate + 'ms');
}

function isValidFileName(str) {
  return !/[~`!#$%\^&*+=\-\[\]\\'; , /{}|\s\\":<>\?]/g.test(str);
}

function formatDate(d) {
  var date = d.getDate();
  var hour = d.getUTCHours();
  var mins = d.getUTCMinutes();
  var secs = d.getUTCSeconds();
  var year = d.getUTCFullYear();
  var month = d.getUTCMonth();
  return year + '-' + pad((month + 1), 1) + '-' + pad(date, 1) + 'T' + pad(hour, 1) + ':' + pad(mins, 1) + ':' + pad(secs, 1) + '+0000';
}

function responseTime(res) {
  if (typeof res.getHeader === 'function') {
    return res.getHeader('X-Response-Time');
  }
  return undefined;
}

function getUrl(req) {
  var format= req.url || req.originalUrl;
  if(format.indexOf('?') > -1) format = format.split('?')[0];
  return format;
}

function getQs(req) {
  var format= req.url || req.originalUrl;
  if(format.indexOf('?') === -1) return '-';
  return format.split('?')[1];
}

function getHost(req) {
  var host = req.headers.host;
  if (host.indexOf(':') === -1)
    return host;
  return host.split(':')[0];
}

function getXff(req) {
  var xff = req.headers['x-forwarded-for'] || '-';
  if (xff.indexOf(':') === -1)
    return xff;
  newarr = [];
  arr = xff.split(',').forEach(function (x) {
      newarr.push(x.split(':')[0]);
    });
  return newarr.join(", ");
}

function getPort(req) {
  var host = req.headers.host;
  if (host.indexOf(':') === -1)
    return '-';
  return host.split(':')[1];
}

function pad(num, step) {
  num = String(num);
  if (num.length !== 1) {
    return num;
  }
  var zeroes = '';
  for (var i = step - 1; i >= 0; i--) {
    zeroes = zeroes + '0';
  }
  return zeroes + num;
}
