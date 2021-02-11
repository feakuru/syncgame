var app = require('express')();
var ejs = require('ejs');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_INTERVAL = 0;
const DEFAULT_CLICKS_TO_UP_SCORE = 1;
const DEFAULT_UP_SCORE_TIMEOUT = 0;

let games = {};
let past_game_logs = [];
let masteredGameId = null;
let masterId = null;

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

let emitToParticipants = (gameId, event, data) => {
    if (masteredGameId === gameId) {
        io.to(gameId).to(games[gameId]['player']).to(masterId).emit(
            event,
            data
        );
    } else {
        io.to(gameId).to(games[gameId]['player']).emit(
            event,
            data
        );
    }
}

io.on('connection', (socket) => {
    socket.on('game create', (name) => {
        let settings = {
            'timeout': DEFAULT_TIMEOUT,
            'interval': DEFAULT_INTERVAL,
            'clicksToUpScore': DEFAULT_CLICKS_TO_UP_SCORE,
            'upScoreTimeout': DEFAULT_UP_SCORE_TIMEOUT
        }
        games[socket.id] = {
            'name': name,
            'settings': settings, 
            'score': 0,
            'clicks': 0,
            'canUpScore': true,
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
        masterId = socket.id;
        socket.emit('game joined');
        games[gameId]['log'].push(
            `${new Date()} | master ${socket.id} joined game`
        )
    });

    socket.on('game settings change', settings => {
        let newSettings = {
            ...games[masteredGameId]['settings'],
            ...settings
        };
        games[masteredGameId]['settings'] = newSettings;
        emitToParticipants(masteredGameId, 'game settings', newSettings);
        games[gameId]['log'].push(
            `${new Date()} | settings changed: ${JSON.stringify(newSettings)}`
        )
    });

    socket.on('button pressed', () => {
        let gameId = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        emitToParticipants(gameId, 'button pressed');
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
        games[gameId]['log'].push(
            `${new Date()} | button pressed in time`
        )
        games[gameId]['clicks'] += 1;
        setTimeout(
            () => {
                games[gameId]['canUpScore'] = true;
            },
            games[gameId]['settings']['upScoreTimeout']
        );
        if (
                games[gameId]['canUpScore']
                && (
                    games[gameId]['clicks']
                    >= games[gameId]['settings']['clicksToUpScore']
                )) {
            games[gameId]['canUpScore'] = false;
            games[gameId]['clicks'] = 0;
            games[gameId]['score'] += 50;
            games[gameId]['log'].push(
                `${new Date()} | score updated to ${games[gameId]['score']}`
            )
        }
        emitToParticipants(gameId, 'score', { 'score': games[gameId]['score'] });
    });

    socket.on('disconnect', () => {
        if (socket.id in games) {
            past_game_logs.push(games[socket.id]['log']);
            delete games[socket.id];
            console.log('game ' + socket.id + ' deleted')
        }
    });
});

http.listen(4411, () => {
    console.log('listening on *:4411');
});
