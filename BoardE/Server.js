var http = require('http');
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

function send404Response(response)
{
    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("Error 404: Page not found!");
    response.end();
}

function onRequest(request, response)
{
    if(request.method === 'GET' && request.url === '/')
    {
        response.writeHead(200, {"Content-Type": "text/html"});
        fs.createReadStream("./html/bootstrap.html").pipe(response);
    }
    /*else if(request.url.match('/room.html'))
    {
        response.writeHead(200, {"Context-Type": "text/html"});
        fs.createReadStream("./html/room.html").pipe(response);
    }*/
    else if(request.url.match("\.css$"))
    {
        response.writeHead(200, {"Content-Type": "text/css"});
        fs.createReadStream(path.join(__dirname, request.url)).pipe(response);
    }
    else if(request.url.match("\.png$"))
    {
        response.writeHead(200, {"Content-Type": "image/png"});
        fs.createReadStream(path.join(__dirname, request.url)).pipe(response);
    }
    else if(request.url.match("\.jpg$"))
    {
        response.writeHead(200, {"Content-Type": "image/jpg"});
        fs.createReadStream(path.join(__dirname, request.url)).pipe(response);
    }
    else if(request.url.match("\.js$"))
    {
        response.writeHead(200, {"Content-Type": "text/js"});
        fs.createReadStream(path.join(__dirname, request.url)).pipe(response);
    }
    else
    {
        send404Response(response);
    }
}

var clients;
var last_id;
var last_room;

var stages;
var actualPositions;

var server;
var wsServer;
var port;

function AS_Server()
{
    clients = [];
    last_id = 0;
    last_room = 1;

    stages = [];
    actualPositions = [];

    server = http.createServer(onRequest);

    wsServer = new WebSocketServer({ server: server });
    wsServer.on('connection', onConnect);
}

AS_Server.default_port = 9041;

AS_Server.prototype.listen = function(puerto)
{
    port = puerto || AS_Server.default_port;
    console.log('AS_Server listening in port ' + port + "...");
    server.listen(port);
};

function onConnect(request)
{
    console.log("[Server]: New user!");

    //Messages
    onMessage(request);

    //Disconnect
    disconnect(request);
}

function onMessage(request)
{
    request.onmessage = (function(event)
    {
        var data = event.data;

        var dataParsed = JSON.parse(data);
        var dataType = dataParsed.type;

        if(dataType === "new")
        {
            newUser(request);

            if(stages.length > 0)
            {
                sendPositionsToNewUser(request, dataParsed);
                sendMessageYesPosition(request);
            }
            else
            {
                sendMessageNoPosition(request);
            }
        }
        else if(dataType === "realTimePosition")
        {
            addPositionStages(dataParsed);
            sendRealTimePosition(request, dataParsed);
        }
        else if(dataType === "getPosition")
        {
            sendPositionStage(dataParsed);
        }
        else if(dataType === "deleteStage")
        {
            deleteLastStage(dataParsed);
        }
        else if(dataType === "resetBoard")
        {
            resetBoard();
        }
    });
}

function addPositionStages(dataParsed)
{
    if(stages.length < 11)
        stages.push(dataParsed);
    else
    {
        for(var i = 0; i < stages.length; i++)
        {
            if(stages[i].stage === dataParsed.stage && stages[i].id === dataParsed.id)
            {
                stages[i].posX = dataParsed.posX;
                stages[i].posY = dataParsed.posY;

                return;
            }
        }

        stages.push(dataParsed);
    }
}

function deleteLastStage(dataParsed)
{
    var actual;
    if(dataParsed.lastStage === dataParsed.stage)
        actual = true;

    for(var i = 0; i < stages.length; i++)
    {
        if(stages[i].stage === dataParsed.lastStage)
        {
            stages.splice(i, 11);
        }
    }
    console.log(stages);

    if(actual)
    {
        if(dataParsed.stage > 1)
            dataParsed.stage--;

        sendPositionStage(dataParsed)
    }

}

function disconnect(request)
{
    request.on('close', function(){
        console.log("[Server]: User with id: " + clients.indexOf(request).userID + " has disconnected.");

        clients.splice(clients.indexOf(request), 1);    //Delete user from clients
    });
}

function newUser(request)
{
    request.userID = last_id;

    clients.push(request);

    last_id++;
}

function resetBoard()
{
    stages.splice(0, stages.length);
}

function sendMessageNoPosition(request)
{
    for(var i = 0; i < clients.length; i++)
    {
        if(request.userID === clients[i].userID)
            clients[i].send(JSON.stringify({type: "NoPositionsStore"}));
    }
}

function sendMessageYesPosition(request)
{
    for(var i = 0; i < clients.length; i++)
    {
        if(request.userID === clients[i].userID)
            clients[i].send(JSON.stringify({type: "YesPositionsStore"}));
    }
}

function sendPositionsToNewUser(request, dataParsed)
{
    var stage = dataParsed.stage;

    for(var i = 0; i < stages.length; i++)
    {
        if(stages[i].stage === stage)
        {
            for(var j = 0; j < clients.length; j++)
            {
                if(request.userID === clients[j].userID)
                {
                    clients[j].send(JSON.stringify(stages[i]));
                }
            }
        }
    }
}

function sendRealTimePosition(request, dataParsed)
{
    for(var i = 0; i < clients.length; i++)
    {
        if(request.userID !== clients[i].userID)
        {
            clients[i].send(JSON.stringify({type: dataParsed.type, posX: dataParsed.posX, posY: dataParsed.posY, rad: dataParsed.rad, color: dataParsed.color, id: dataParsed.id, stage: dataParsed.stage}));
        }
    }
}

function sendPositionStage(dataParsed)
{
    var stage = dataParsed.stage;

    for(var i = 0; i < stages.length; i++)
    {
        if(stages[i].stage === stage)
        {
            for(var j = 0; j < clients.length; j++)
            {
                clients[j].send(JSON.stringify(stages[i]));
            }
        }
    }
}

module.exports.AS_Server = AS_Server;