var app = require('express')();
var ejs = require('ejs');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let games = [];

app.get('/', (req, res) => {
    ejs.renderFile(
        __dirname + '/index.html',
        { 'games': games },
        {},
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                res.send(result);
            }
        }
    )
});

io.on('connection', (socket) => {
    socket.on('game create', (name) => {
        console.log(name + ' [' + socket.id + '] creates game');
        games.push({'id': socket.id, 'name': name});
    });

    socket.on('game join', (message) => {
        name = message.split('|')[0];
        game_id = message.split('|')[1];
        console.log(name + ' [' + socket.id + '] joins game ' + game_id);
    });

    socket.on('disconnect', () => {
        console.log(socket.id + ' disconnected');
        games = games.filter(game => (game['id'] !== socket.id))
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});
