var debug = require('debug')('rtc:socket');
var socketio = require('socket.io');
var jwt = require('jsonwebtoken');
var User = require('./user.js');
var Room = require('./room.js');
var io;

User.setup(Room);
Room.setup(User);

module.exports = function (server) {

  io = socketio(server);

  // authenticate
  io.use(function (socket, next) {
    var token = socket.request.query.token;

    if (!token) {
      error = new Error('credentials_required');
      return next(error);
    }

    var options = {
      secret: 'secret',
    };

    jwt.verify(token, options.secret, options, function(err, decoded) {

      if (err) {
        error = new Error('invalid_token');
        return next(error);
      }

      socket.decoded_token = decoded;
      next();
    });
  });

  io.on('connect', function (socket) {

    var user;

    User.getById(socket.decoded_token._id, function (err, u) {
      if (err) return socket.emit('error', err);
      user = u;
      user.connect(socket);
    });

    socket.on('join', function (data) {
      if (user) {
        var room = Room.getById(data._id, function (err, room) {
          // if db err or room not exist
          if (err || !room) {
            user.echo('join_response', {
              success: false,
              message: 'room does not exist'
            });
          }

          // join room
          user.join(room, function () {
            user.echo('join_response', {
              success: true,
            });
            user.broadcast('user_joined', {
              username: user.name,
            });
          });
        });
      }
    });

    socket.on('leave', function () {
      if (user) {
        var room = user.room;

        user.leave(function () {
          user.broadcast('user_left', {
            username: user.name,
          }, room.name);
        });
      }
    });

    // when the client emits 'new message', we broadcast it to others
    socket.on('new_message', function (data) {
      if (user) {
        user.broadcast('new_message', {
          username: user.name,
          message: data
        });
      }
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
      if (user) {
        user.broadcast('typing', {
          username: user.name
        });
      }
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop_typing', function () {
      if (user) {
        user.broadcast('stop_typing', {
          username: user.name
        });
      }
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      if (user) {
        user.disconnect(function () {
          user.broadcast('user_left', {
            username: user.name,
          });
        });
      }
    });
  });

};
