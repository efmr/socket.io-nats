# socket.io-nats

This adapter enables multiple socket.io instances to broadcast and emit events to and from each other through [NATS](http://nats.io/), based on the [socket.io-redis](https://github.com/socketio/socket.io-redis).

## Install

```
npm install socket.io-nats
```

## How to use

```js
var io = require('socket.io')(3000);
var nats = require('socket.io-nats');
io.adapter(nats());
```

By running socket.io with the `socket.io-nats` adapter you can run
multiple socket.io instances in different processes or servers that can
all broadcast and emit events to and from each other.

If you need to emit events to socket.io instances from a non-socket.io
process, you should use [socket.io-nats-emitter](https://github.com/efmr/socket.io-nats-emitter).

## API

### adapter(opts)

The following options are allowed:

- `key`: the name of the key to pub/sub events on as prefix (`socket.io`)
- `delimiter`: optional, channels delimiter
- `nc`: optional, the nats client
- `...`: [nats client options](https://github.com/nats-io/node-nats) (ignored if nats client is supplied)

If you decide to supply `nc`, make sure you use
[node_nats](https://github.com/nats-io/node-nats) as a client or one
with an equivalent API.

### NatsAdapter

The nats adapter instances expose the following properties
that a regular `Adapter` does not

- `uid`
- `prefix`
- `nc`
- `delimiter`

## Client error handling

Access the `nc` property of the
Nats Adapter instance to subscribe to its `error` event:

```js
var nats = require('socket.io-nats');
var adapter = nats();
adapter.nats.on('error', function(){});
```

## Custom client (eg: clustered nats)

If you need to create a NatsAdapter to a Nats client instance
that has clustered connection

```js
var nats = require('nats');

var servers = ['nats://nats.io:4222', 'nats://nats.io:5222', 'nats://nats.io:6222'];

// Randomly connect to a server in the cluster group.
var nc = nats.connect({'servers': servers});

// currentServer is the URL of the connected server.
console.log("Connected to " + nc.currentServer.host);

var adapter = require('socket.io-nats');

io.adapter(adapter({ nc: nc }));
```

## Protocol

The `socket.io-nats` adapter broadcasts and receives messages on particularly named Nats channels. For global broadcasts the channel name is:
```
prefix + '.' + namespace
```

In broadcasting to a single room the channel name is:
```
prefix + '.' + namespace + '.' + room
```


- `prefix`: The base channel name. Default value is `socket.io`. Changed by setting `opts.key` in `adapter(opts)` constructor
- `delimiter`: The delimiter of channel name. Default value is `.`. Changed by setting `opts.delimiter` in `adapter(opts)` constructor
- `namespace`: See https://github.com/socketio/socket.io#namespace.
- `room` : Used if targeting a specific room, the room is URL encoded.


## License

MIT
