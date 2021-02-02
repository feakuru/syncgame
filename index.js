var app = require('express')();
var ejs = require('ejs');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const DEFAULT_TIMEOUT = 2000;

let games = {};
let past_game_logs = [];
let masteredGameId = null;

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

app.get('/master', (req, res) => {
    ejs.renderFile(
        __dirname + '/master.html',
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

app.get('/logs', (req, res) => {
    res.send(
        `
        <h1>[LOGS]</h1>
        /* this page is not updated in realtime, sorry */
        <h2>Past games:</h2>
        ${past_game_logs.map(log => log.join("<br>")).join("<br><br>")}<br>
        <h2>Current games:</h2>
        ${Object.entries(games).map(game => `<h3>${game[0]}</h3> ${game[1]['log'].join("<br>")}`).join("<br><br>")}
        `
    )
});

io.on('connection', (socket) => {
    socket.on('game create', (name) => {
        let settings = {
            'timeout': DEFAULT_TIMEOUT
        }
        games[socket.id] = {
            'name': name,
            'settings': settings, 
            'score': 0,
            'log': [
                `${new Date()} | ${name} [${socket.id}] creates game`
            ]
        };
        socket.emit('game settings', settings)
        io.emit('game created', {'id': socket.id, 'name': name})
    });

    socket.on('game join', (message) => {
        playerName = message.split('|')[0];
        gameId = message.split('|')[1];
        if (gameId in games) {
            if ('player' in games[gameId]) {
                games[gameId]['log'].push(
                    `${new Date()} | not allowing to join game: already joined by ${games[gameId]['player']}`
                )
            } else {
                games[gameId]['player'] = socket.id;
                socket.emit('game joined');
                socket.emit('game settings', games[gameId]['settings'])
                games[gameId]['log'].push(
                    `${new Date()} | ${playerName} [${socket.id}] joins game ${gameId}`
                )
            }
        }
        else {
            console.log(
                `not allowing to join game: no such game ${gameId}`
            )
        }
    });

    socket.on('game master join', (gameId) => {
        if (gameId in games) {
            masteredGameId = gameId;
        }
        socket.emit('game joined');
    });

    socket.on('game settings change', settings => {
        games[masteredGameId]['settings'] = settings;
        io.to(masteredGameId).emit('game settings', settings);
        io.to(games[masteredGameId]['player']).emit('game settings', settings);
    });

    socket.on('button pressed', () => {
        let gameId = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        io.to(gameId).emit('button pressed');
        io.to(games[gameId]['player']).emit('button pressed');
        games[gameId]['log'].push(
            `${new Date()} | button pressed by ${socket.id}`
        )
    })

    socket.on('score', () => {
        let gameId = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        games[gameId]['score'] += 50;
        io.to(gameId).emit('score', {'score': games[gameId]['score']});
        io.to(games[gameId]['player']).emit('score', { 'score': games[gameId]['score'] });
        games[gameId]['log'].push(
            `${new Date()} | score updated to ${games[gameId]['score']}`
        )
    });

    socket.on('disconnect', () => {
        if (socket.id in games) {
            past_game_logs.push(games[socket.id]['log']);
            delete games[socket.id];
            console.log('game ' + socket.id + ' deleted')
        }
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});
