# NodeJSMediaServer
> A nodejs based media server for Sitecore WCMS.


This is a fairly simple nodejs / mssql solution to off-load requests for media library items without needing to run a separate instance of Sitecore. 

## Prerequisite

1. An instance of Sitecore WCMS
2. Access to the Sitecore database(s)
3. NodeJS
4. Your choice of application routing / proxy redirect  (I am using IIS ARR 3.0 and redirecting any requests that start with /~/media to my media server)

## Installation and Configuration

```sh
git clone https://github.com/AndrewWJackson/NodeJSMediaServer.git
cd NodeJSMediaServer
npm install
```

### ./config/app.json
```javascript
{
  server:{ //This is the hub or main server portion that you will direct requests to.
    port:8087,
    ip:'127.0.0.1',
    customheaders:[
      {'arrnode':'NodeJSMediaServer'},
      {'X-Powered-By': 'Hopes and Dreams'}
    ]
  },
  endpoints:[ // The main thread will spin these up (each creates a new nodejs process) at first run. You can configure as many endpoints as you like, I suggest starting at 5, keeping in mind that they do need resources to run.
    {
      port:9010, // This can be any available port.
      ip:'127.0.0.1', // This can be any local ip, make sure your host(s) resolve to this ip locally.
      enabled: false, // This is an internal flag, we start at false and set to true when the endpoint starts.
      maxmem: '256MB', // This controls how much memory the process can be used before it is recycled, setting this too high or low will affect performance, you'll need to find your Goldilocks setting.
      customheaders:[
        {'endpoint':'1'}
      ]
    }
  ],
  sql:{
    server: '127.0.0.1',
    database: 'sitecore_web',
    user: 'sqluser',
    password: 'sqlpass'
  },
  caching:{
    maxage: 31536000,
    cachability: 'public',
    vary: 'Accept-Encoding'
  }
}
```

Execute the included sql script on the database(s) you would like to serve from.

Configure ARR to direct media requests to your media server.


Start the nodejs media server.
```sh
node mediaservice.js
```

## Meta

Andrew Jackson - jackson.aw[a]gmail.com

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/andrewwjackson/NodeJSMediaServer](https://github.com/andrewwjackson/)