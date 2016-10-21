# wamp.js
The Web Application Messaging Protocol for js, works in browser and react-native.

This Project is ported from [autobahn-js](https://github.com/crossbario/autobahn-js), I removed all it's depencies(crypto-js, when, ws, msgpack-lite), and transformed into es6 style code. My aim is to work in web browser(support WebSocket, Promise) as well as react-native. so only supports json protocol.

### install
```
npm i -S wamp.js
```

### API
now, wamp.js's API is the same as autobahn-js: [autobahn-js API](http://autobahn.ws/js/reference.html)

```javascript
// autobahn-js
var autobahn = require('autobahn');
new autobahn.Connection(...);

// wamp.js
import wamp = require('wamp.js');
new wamp.Connection(...);
```

### NOTE && NEW
```
// note:
// !!default enable automatic reconnect if host is unreachable

// new Apis
wamp.debugOn();
wamp.debugOff();
wamp.WAMP_STATUS;
wamp.STATUS;


// add onstatuschange, this can replace onopen and onclose;
connection.onstatuschange(status, details);
// status-> STATUS.DISCONNECTED, details-><close details>
// status-> STATUS.CONNECTING, details->undefined
// status-> STATUS.CONNECTED, details-><onjoin details>
// status-> STATUS.CLOSED, details-><close details>
```
