# wamp.js2
The Web Application Messaging Protocol for js, works in browser and react-native.

This Project is ported from [autobahn-js](https://github.com/crossbario/autobahn-js), I removed all it's depencies(crypto-js, when, ws, msgpack-lite), and transformed into es6 style code. My aim is to work in web browser(support WebSocket, Promise) as well as react-native. so only supports json protocol.

### install
```
npm install --save wamp.js2
```
or
```
yarn add wamp.js2
```

### API
wamp.js2's API is the same as autobahn-js: [autobahn-js API](http://autobahn.ws/js/reference.html)

```javascript
import wamp from 'wamp.js2';
new wamp.Connection(...);
```

### NOTE && NEW
```
// note:
// !!default enable automatic reconnect if host is unreachable

// new APIs and constants.
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


// add retry and networkOffline notify.
// 1. automatic reconnect is not useful as retry interval time get longer, when network resume online, you must wait.
// 2. as WebSocket in browser(at least chrome) does not close when turn off network,
//       but it cannot send or recevie msgs, so I want to close it manually.
connection.retry(); // initiate to reconnect.
connection.networkOffline(); // notify to close transport.

// add .ping() and .addOnpongListener(handler)
session.ping()
session.addOnponListener(handler)
```
