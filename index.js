var app = require('express')();
var ejs = require('ejs');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let games = {};
let past_game_logs = [];

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
        games[socket.id] = {
            'name': name,
            'score': 0,
            'log': [
                `${new Date()} | ${name} [${socket.id}] creates game`
            ]
        };
    });

    socket.on('game join', (message) => {
        name = message.split('|')[0];
        game_id = message.split('|')[1];
        if (game_id in games) {
            if ('player' in games[game_id]) {
                games[game_id]['log'].push(
                    `${new Date()} | not allowing to join game: already joined by ${games[game_id]['player']}`
                )
            } else {
                games[game_id]['player'] = socket.id;
                socket.emit('game joined');
                games[game_id]['log'].push(
                    `${new Date()} | ${name} [${socket.id}] joins game ${game_id}`
                )
            }
        }
        else {
            console.log(
                `not allowing to join game: no such game ${game_id}`
            )
        }
    });

    socket.on('button pressed', () => {
        let game_id = (
            socket.id in games
                ? socket.id
                : Object.entries(games).filter(
                    game => game[1]['player'] === socket.id
                )[0][0]
        );
        io.to(game_id).emit('button pressed');
        io.to(games[game_id]['player']).emit('button pressed');
        games[game_id]['log'].push(
            `${new Date()} | button pressed by ${socket.id}`
        )
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
        io.to(games[game_id]['player']).emit('score', { 'score': games[game_id]['score'] });
        games[game_id]['log'].push(
            `${new Date()} | score updated to ${games[game_id]['score']}`
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
