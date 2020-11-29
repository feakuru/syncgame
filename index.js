var app = require('express')();
var ejs = require('ejs');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let games = {};

app.get('/', (req, res) => {
    console.log(games);
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
        games[socket.id] = {'name': name, 'score': 0};
    });

    socket.on('game join', (message) => {
        name = message.split('|')[0];
        game_id = message.split('|')[1];
        if (game_id in games) {
            if ('player' in games[game_id]) {
                console.log(
                    "not allowing to join game: already joined by "
                    + games[game_id]['player']
                );
            } else {
                games[game_id]['player'] = socket.id;
                socket.emit('game joined');
                console.log(
                    name
                    + ' ['
                    + socket.id
                    + '] joins game '
                    + game_id
                );
            }
        }
        else {
            console.log(
                "not allowing to join game: no such game "
                + game_id
            )
        }
    });

    socket.on('button pressed', () => {
        console.log('button pressed!');
        let game_id = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        io.to(game_id).emit('button pressed');
        io.to(games[game_id]['player']).emit('button pressed');
    })

    socket.on('score', () => {
        let game_id = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        games[game_id]['score'] += 50;
        io.to(game_id).emit('score', {'score': games[game_id]['score']});
        io.to(games[game_id]['player']).emit('score', {'score': games[game_id]['score']});
    });

    socket.on('disconnect', () => {
        console.log(socket.id + ' disconnected');
        if (socket.id in games) {
            delete games[socket.id];
            console.log('game ' + socket.id + ' deleted')
        }
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});
