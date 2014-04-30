var debug = require('debug')('rtc:room');
var util = require('util');
var async = require('async');
var config = require('./config');
var Datastore = require('nedb');
var User;

// rooms data store
var rooms = new Datastore({
  filename: config.db.rooms,
  autoload: true,
});

var Room = function (doc) {
  this._id = doc._id;
  this.name = doc.name;
  this.lang = doc.lang || 'en';
  this.capacity = doc.capacity || 5;
};

Room.setup = function (dep) {
  // dependency injection
  // to avoid circular require calls
  User = dep;
};

Room.getById = function (_id, fn) {
  rooms.findOne({ _id: _id}, function (err, doc) {
    if (err) return fn(err);

    if (doc) {
      fn(err, new Room(doc));
    } else {
      fn(err);
    }
  });
};

Room.get = function (fields, fn) {
  rooms.find(fields, function (err, docs) {
    if (err) return fn(err);

    var rooms = docs.map(function (doc) {
      return new Room(doc);
    });
    fn(err, rooms);
  });
};

Room.getAll = function (fn) {
  this.get({}, function (err, rooms) {
    if (err) return fn(err);
    fn(err, rooms);
  });
};

Room.getByName = function (name, fn) {
  this.get({name: name}, function (err, rooms) {
    if (err) return fn(err);
    fn(err, rooms);
  });
};

Room.deleteById = function(_id, fn) {
  rooms.remove({_id: _id}, {}, function (err, numRemoved) {
    if (err) return fn(err);
    debug('%d room(s) deleted', numRemoved);
    if (fn) fn(err, numRemoved);
  });
};

Room.deleteAll = function(fn) {
  rooms.remove({}, {multi: true}, function (err, numRemoved) {
    if (err) return fn(err);
    debug('%d room(s) deleted', numRemoved);
    if (fn) fn(err, numRemoved);
  });
};

Room.prototype.save = function (fn) {
  var self = this;

  if (!self._id) {
    // insert
    rooms.insert({
      name: self.name,
      lang: self.lang,
      capacity: self.capacity,
    }, function (err, doc) {
      if (err) return fn(err);
      debug('room %s saved', doc.name);

      self._id = doc._id;
      fn(err, doc);
    });
  } else {
    // update
    rooms.update({_id: self._id}, {
      name: self.name,
      lang: self.lang,
      capacity: self.capacity,
    }, {}, function (err, numUpdated) {
      if (err) return fn(err);
      debug('room %s updated', self.name);

      fn(err, numUpdated);
    });
  }

  return this;
};

Room.prototype.destroy = function (fn) {
  if (this._id) {
    Room.deleteById(this._id, fn);
  }
};

Room.prototype.getUsers = function (fn) {
  User.get({room_id: this._id}, fn.bind(this));
};

Room.prototype.close = function (fn) {
  var self = this;

  self.getUsers(function (err, users) {
    if (err) return fn(err);

    if (users.length === 0) {
      self.destroy(function (err, numRemoved) {
        debug('room closed');
        if (fn) fn(err, numRemoved);
      });
    } else {
      debug('cannot close, room not empty');
      if (fn) process.nextTick(fn.bind(self));
    }
  });
};

module.exports = Room;
