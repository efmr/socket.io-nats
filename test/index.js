var http = require('http').Server;
var io = require('socket.io');
var ioc = require('socket.io-client');
var expect = require('expect.js');
var adapter = require('../');

// create a pair of socket.io server+client
function create(namespace, callback) {
  var srv = http();
  var sio = io(srv);
  var nsp = typeof namespace === 'string' ? namespace : '/';
  var fn = callback || namespace;
  sio.adapter(adapter());
  srv.listen(function listen(err) {
    if (err) throw err; // abort tests
    fn(sio.of(nsp), ioc('http://localhost:' + srv.address().port + nsp));
  });
}

describe('socket.io-nats', function describeNats() {
  it('broadcasts', function broadcast(done) {
    create(function one(server1, client1) {
      create(function two(server2, client2) {
        client1.on('woot', function onWoot(a, b) {
          expect(a).to.eql([]);
          expect(b).to.eql({ a: 'b' });
          client1.disconnect();
          client2.disconnect();
          done();
        });
        server2.on('connection', function onConnect(c2) {
          c2.broadcast.emit('woot', [], { a: 'b' });
        });
      });
    });
  });
  it('broadcasts to namespaces', function namespaces(done) {
    create('/test', function one(server1, client1) {
      create('/test', function two(server2, client2) {
        create(function three(server3, client3) {
          client1.on('woot', function onWoot(a, b) {
            expect(a).to.eql([]);
            expect(b).to.eql({ a: 'b' });
            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
            setTimeout(done, 100);
          });
          client3.on('woot', function broadcast() {
            throw new Error('Not in namespace');
          });
          server2.on('connection', function onConnect(c2) {
            c2.broadcast.emit('woot', [], { a: 'b' });
          });
        });
      });
    });
  });
  it('broadcasts to rooms', function roomBroadcast(done) {
    create(function one(server1, client1) {
      create(function two(server2, client2) {
        create(function three(server3, client3) {
          server1.on('connection', function onConnect(c1) {
            c1.join('woot');
          });

          server2.on('connection', function onConnect(c2) {
            // does not join, performs broadcast
            c2.on('do broadcast', function boardcast() {
              c2.broadcast.to('woot').emit(
                'broadcast');
            });
          });

          server3.on('connection', function onConnect() {
            // does not join, signals broadcast
            client2.emit('do broadcast');
          });

          client1.on('broadcast', function broadcast() {
            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
            setTimeout(done, 100);
          });

          client2.on('broadcast', function broadcast() {
            throw new Error('Not in room');
          });

          client3.on('broadcast', function broadcast() {
            throw new Error('Not in room');
          });
        });
      });
    });
  });

  it('doesn\'t broadcast to left rooms', function noBroadcast(done) {
    create(function one(server1, client1) {
      create(function two(server2, client2) {
        create(function three(server3, client3) {
          server1.on('connection', function onConnect(c1) {
            c1.join('woot');
            c1.leave('woot');
          });

          server2.on('connection', function onConnect(c2) {
            c2.on('do broadcast', function broadcast() {
              c2.broadcast.to('woot').emit(
                'broadcast');

              setTimeout(function timeout() {
                client1.disconnect();
                client2.disconnect();
                client3.disconnect();
                done();
              }, 100);
            });
          });

          server3.on('connection', function onConnect() {
            client2.emit('do broadcast');
          });

          client1.on('broadcast', function broadcast() {
            throw new Error('Not in room');
          });
        });
      });
    });
  });

  it('deletes rooms upon disconnection', function delOnDisconnect(done) {
    create(function one(server, client) {
      server.on('connection', function onConnect(c) {
        c.join('woot');
        c.on('disconnect', function disconnect() {
          expect(c.adapter.sids[c.id]).to.be.empty();
          expect(c.adapter.rooms).to.be.empty();
          client.disconnect();
          done();
        });
        c.disconnect();
      });
    });
  });

  // https://github.com/socketio/socket.io-redis/pull/76
  it('broadcasts to multiple rooms at a time', function multiple(done) {
    create(function one(server1, client1) {
      create(function two(server2, client2) {
        create(function three(server3, client3) {
          var called = false;
          server1.on('connection', function onConnect(c1) {
            c1.join('foo');
            c1.join('bar');
          });

          server2.on('connection', function onConnect(c2) {
            // does not join, performs broadcast
            c2.on('do broadcast', function broadcast() {
              c2.broadcast.to('foo').to('bar').emit(
                'broadcast');
            });
          });

          server3.on('connection', function onConnect() {
            // does not join, signals broadcast
            client2.emit('do broadcast');
          });

          client1.on('broadcast', function onConnect() {
            if (called) {
              done(new Error('Called more than once'));
              return;
            }
            called = true;
            setTimeout(done, 100);
          });

          client2.on('broadcast', function broadcast() {
            throw new Error('Not in room');
          });

          client3.on('broadcast', function broadcast() {
            throw new Error('Not in room');
          });
        });
      });
    });
  });
});
