/**
 * Module dependencies
 */
var nats = require('nats');
var uid2 = require('uid2');
var async = require('async');
var util = require('util');
var Adapter = require('socket.io-adapter');
var debug = require('debug')('socket.io-nats');

/**
 * Returns a NATS Adapter class.
 *
 * @param {Object} [adapterOptions] - adapter options
 * @return {NatsAdapter} adapter
 * @api public
 */

function adapter(adapterOptions) {
  var options = adapterOptions || {};
  var nc = options.nc || nats.connect(options);
  var prefix = options.key || 'socket.io';
  var delimiter = options.delimiter || '.';
  // this server's key
  var uid = uid2(6);

  /**
   * Adapter constructor.
   * @constructor
   * @param {String} nsp - namespace
   * @api public
   */
  function Nats(nsp) {
    Adapter.call(this, nsp);
    this.prefix = prefix + delimiter + nsp.name;
    this.delimiter = delimiter;
    this.nc = nc;
    this.uid = uid;
    this.subs = {};
    this.subs[this.prefix] = nc.subscribe(this.prefix,
      this.onMessage.bind(this));
  }

  /**
   * Inherits from Adapter
   */
  util.inherits(Nats, Adapter);

  /**
   * @param  {string} [room] - channel room
   * @return {string} channel name
   */
  Nats.prototype.channelName = function channelName(room) {
    return room ? this.prefix + this.delimiter + encodeURI(room) :
      this.prefix;
  };

  /**
   * @param  {string | object} msg - incoming message
   * @param  {string} [reply] - replyTo
   * @param  {string} subject - message channel
   * @param  {number} sid - subscription id
   * @return {void}
   * @api private
   */
  Nats.prototype.onMessage = function onMessage(msg) {
    var args = typeof msg === 'string' ? JSON.parse(msg) : msg;
    var packet;

    if (uid === args.shift()) {
      debug('ignore same uid');
      return;
    }

    packet = args[0];

    if (packet && packet.nsp === undefined) {
      packet.nsp = '/';
    }

    if (!packet || packet.nsp !== this.nsp.name) {
      debug('ignore different namespace');
      return;
    }

    args.push(true);

    this.broadcast.apply(this, args);
  };

  /**
   * Broadcasts a packet.
   *
   * @param {Object} packet - packet to emit
   * @param {Object} opts - broadcast options
   * @param {Boolean} remote - whether the packet came from another node
   * @return {void}
   * @api public
   */
  Nats.prototype.broadcast = function broadcast(packet, opts, remote) {
    var msg;
    Adapter.prototype.broadcast.call(this, packet, opts);
    if (!remote) {
      msg = JSON.stringify([uid, packet, opts]);
      if (opts.rooms && opts.rooms.length === 1) {
        nc.publish(this.channelName(opts.rooms[0]), msg);
      } else {
        nc.publish(this.channelName(), msg);
      }
    }
  };

  /**
   * Subscribe client to room messages.
   *
   * @param {String} id - client id
   * @param {String} room - room to join
   * @param {Function} [fn] - callback
   * @return {void}
   * @api public
   */
  Nats.prototype.add = function add(id, room, fn) {
    var channel = this.channelName(room);
    debug('adding %s to %s ', id, room);
    Adapter.prototype.add.call(this, id, room);
    if (!this.subs[channel]) {
      this.subs[channel] = nc.subscribe(channel, this.onMessage.bind(this));
    }
    if (fn) process.nextTick(fn.bind(null, null));
  };

  /**
   * Unsubscribe client from room messages.
   *
   * @param {String} id - client id
   * @param {String} room - room to leave
   * @param {Function} [fn] - callback
   * @return {void}
   * @api public
   */
  Nats.prototype.del = function del(id, room, fn) {
    var channel = this.channelName(room);
    debug('removing %s from %s', id, room);
    Adapter.prototype.del.call(this, id, room);

    if (this.subs[channel] && !this.rooms[room]) {
      nc.unsubscribe(this.subs[channel]);
      delete this.subs[channel];
    }

    if (fn) process.nextTick(fn.bind(null, null));
  };

  /**
   * Unsubscribe client completely.
   *
   * @param {String} id - client id
   * @param {Function} [fn] - callback
   * @return {void}
   * @api public
   */
  Nats.prototype.delAll = function delAll(id, fn) {
    var self = this;
    var rooms = this.sids[id];
    debug('removing %s from all rooms', id);

    if (!rooms) {
      if (fn) process.nextTick(fn.bind(null, null));
      return;
    }

    async.each(Object.keys(rooms), function iteratee(room, next) {
      self.del(id, room, next);
    }, function callback() {
      delete self.sids[id];
      if (fn) fn(null);
    });
  };

  Nats.uid = uid;
  Nats.nc = nc;
  Nats.prefix = prefix;
  Nats.delimiter = delimiter;
  return Nats;
}

/**
 * Module exports
 */
module.exports = adapter;
