# NodeJSMediaServer
> A nodejs based media server (Tailored for Sitecore CMS).


This is a fairly simple nodejs / mssql solution to off-load media requests, originally designed to aviod the need to run a separate instance of Sitecore.

### Update 2022-07-22:
1. Replaced [Request](https://github.com/request/request) with [Got](https://github.com/sindresorhus/got)
2. Housekeeping
3. Updated config template to include secure connection options for MSSQL
4. Added image type conversion with quality option. 
    * Supported formats, recognised extensions and quality option support:
      * EX: (75% quality) ~/media/this/is/my/path/img.jpg?q=75

        | Format  | Extension | Quality Option (1-100) [Default]  |
        | :---    |   :----:  |       :----:                      |
        | JPEG  |   jpg, jpeg | ✔️ [80] |
        | PNG   |   png       | ✔️ [100] |
        | GIF   |   gif       | ❌ |
        | TIFF  |   tiff      | ✔️ [80] |
        | WEBP  |   webp      | ✔️ [50] |
        | AVIF  |   avif      | ✔️ [50] |

### Update 2019-08-13:
1. Added basic image manipulation
    * Resizing by height [querystring: h, height] and (or) width [querystring: w, width] 
      or percent [querystring: p, pct, percent].
    * Rotation [querystring: r, rot, rotation]
    * EX: (50% size) ~/media/this/is/my/path/img.jpg?p=50
    * EX: (150px width) ~/media/this/is/my/path/img.jpg?w=150
    * EX: (Same rotated 90d) ~/media/this/is/my/path/img.jpg?w=150&rotation=90
    * Supported formats and recognised extensions:

      | Format  | Extension |
      | :---    |   :----:  |
      | JPEG  |   jpg, jpeg |
      | PNG   |   png       |
      | GIF   |   gif       |
      | TIFF  |   tiff      |
      | WEBP  |   webp      |

### Update 2019-05-17:
1. Fixed http logging
2. Added ability to serve from file system
3. Added some size checking to fix issue where file size can exceed alotted ep memory
4. Added ability to recognize and auto switch between id and path requests
    * EX: ~/media/this/is/my/path/img.jpg and ~/media/9A1E4C951C604BCCBBEB5DF3F4A09216[.extension (not required)]
5. Added ability to pull from any configured db (support for preview and content editor)
    * See new config additions below
    * EX: ~/media/9A1E4C951C604BCCBBEB5DF3F4A09216.aspx?db=master
6. Added ability to disable a source
    * See new config additions below

### Prerequisite

1. An instance of Sitecore CMS, BYOSP (Write a stored procedure for your own db that matches the output of the one provided), or a bunch of files you'd like to serve in a folder that is accessible to this app.
2. Access to the Sitecore database(s)
3. NodeJS >= 13.latest
4. Your choice of application routing / proxy redirect  (ex: I am using IIS ARR 3.0 and redirecting any requests that start with /~/media to my media server)

### Installation and Configuration

#### 1. Clone and install
```sh
git clone https://github.com/AndrewWJackson/NodeJSMediaServer.git
cd NodeJSMediaServer
npm install
```

#### 2 ./config/app.json
```javascript
{
  "server":{ //This is the hub or main server portion that you will direct requests to.
    "port":8087,
    "ip":"127.0.0.1",
    "customheaders":[
      {"arrnode": "NodeJSMediaServer"},
      {"X-Powered-By": "Hopes and Dreams"}
    ],
    "sqlEnabled": true, // This is true by default - Set to false to disable DB Media Library
    "fsEnabled": true, // This is true by default - Set to false to disable FS 
    "loggingEnabled": true, 
    "logging": {
      "directory": './logs', //user or service account executing node must have permissions to this path.
      "file": 'mediaservice' //file prefix - a date stamp and the extension .log will be added to this
    }
  },
  "endpoints":[ // The main thread will spin these up (each creates a new nodejs process) at first run. You can configure as many endpoints as you like, I suggest starting at 5, keeping in mind that they do need resources to run.
    {
      "port": 9010, // This can be any available port.
      "enabled": false, // This is an internal flag, we start at false and set to true when the endpoint starts.
      "maxmem": "256MB", // This controls how much memory the process can use before it is recycled. Setting this too high or low will affect performance, you'll need to find your Goldilocks setting.
      "customheaders":[
        {"endpoint":"1"}
      ]
    }
  ],
  "sql":{
    "default": "web", // This is the database requests will default to if no db querystring is present or the requested db is not configured
    "conn": { // By default, 3 database connections will appear, you can add or remove them as needed.
      "master": { // This is the db connection name, it should always be lowercase.
        "server": "127.0.0.1",
        "database": "sitecore_master",
        "user": "sqluser",
        "password": "sqlpass",
        "options": {
            "trustedConnection": true,
            "encrypt": true,
            "enableArithAbort": true,
            "trustServerCertificate": true
        }
      },
      "web": {
        "server": "127.0.0.1",
        "database": "sitecore_web",
        "user": "sqluser",
        "password": "sqlpass",
        "options": {
            "trustedConnection": true,
            "encrypt": true,
            "enableArithAbort": true,
            "trustServerCertificate": true
        }
      },
      "core": {
        "server": "127.0.0.1",
        "database": "sitecore_core",
        "user": "sqluser",
        "password": "sqlpass",
        "options": {
            "trustedConnection": true,
            "encrypt": true,
            "enableArithAbort": true,
            "trustServerCertificate": true
        }
      }
    }
  },
  "filesys": {
      "rootpath": "c:\\inetpub\\wwwroot\\mysite\\website\\fs" // This is the rootpath of your request 
                                      //EX:  If your request is for /~/media/foo/bar/img.jpg 
                                      // your root [/~/media] = c:\inetpub\wwwroot\mysite\website\fs 
                                      // and full reqest [/~/media/foo/bar/img.jpg] = c:\inetpub\wwwroot\mysite\website\fs\foo\bar\img.jpg
  },
  "caching":{
    "maxage": 31536000,
    "cachability": "public",
    "vary": "Accept-Encoding"
  }
}
```

#### 3. Execute the included sql script [prereqsql.sql] on the database(s) you would like to serve from.

#### 4. Configure ARR to direct media requests to your media server.


#### 5. Start the nodejs media server.
```sh
node mediaservice.js
```

### Meta

Andrew Jackson - jackson.aw[a]gmail.com

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/andrewwjackson/](https://github.com/andrewwjackson/)
