/*  
    Author: Philippe Ilharreguy
    Company: SET

    Vivero control server using Node.js.

    To execute serverVivero.js as a deamon (bg process + logging) use:
    sudo nohup node serverVivero.js &>> server.log &
    FOREVER_ROOT=/var/lib/cloud9/Vivero/.forever forever start -a -l /var/lib/cloud9/Vivero/.forever/server.log /var/lib/cloud9/Vivero/serverVivero.js

    Links:
    Express, routes, app example: https://github.com/cwbuecheler/node-tutorial-2-restful-app
    Cron library:   https://github.com/ncb000gt/node-cron/blob/master/lib/cron.js
    Closure issue:  http://conceptf1.blogspot.com/2013/11/javascript-closures.html
    Authentication: https://github.com/jaredhanson/passport-local/tree/master/examples/login
*/


// Application modules
var fs = require('graceful-fs');    // Handle file system read/write.
var async = require('async');
//var cronJob = require('cron').CronJob;
//var cronTime = require('cron').CronTime;
var cronJob = require(__dirname + '/custom_modules/cron').CronJob;
var cronTime = require(__dirname + '/custom_modules/cron').CronTime;
var sysUsage = require('usage');

// Date instance for logging date and time.
var timelib = require('./lib/timelib');

// I2C driver.
var i2cBus = require('i2c-bus');

// Load preview system state.
var jsonFileName = __dirname + '/database/systemState.json';    // File name where is stored json system state.
var loadSystemState = require('./database/loadSystemState');    // Load function to retrieve system state in a json format.
var jsonSystemState = loadSystemState(jsonFileName);    // Load to memory system's state from systemState.json file.


//******************************************************************************
// Wireless Sensor Network Initialization.
var i2cModule = require('./lib/i2cModule');
var I2C = new i2cModule(i2cBus);

// Define I2C board state based on its addresses. Initialize ass zero.
var i2cBoardState = {
    32: 0,
    33: 0
};

//******************************************************************************
// Async queue manager for changing relay's states and avoid two instruction executing at the same time.
var changeRelayStateQueue = async.queue(function(task, next){
    I2C.changeRelayState(task.i2cBoardAddr, task.i2cBoardState, function(err){
        if(err) return console.log('Error sending byte: ' + err);
        //console.log("New relay board state is: " + relayBoardState.toString(2));
        return next();    
    });
}, 1);

//******************************************************************************
// Retrieve relay board state based on systemState.json file. Board address is required.
// Output example: 0b11010001
function getRelayBoardState(i2cBoardAddr){
    var relayBoardState = 0;
    for(var dev in jsonSystemState){
        if(jsonSystemState[dev].i2cBoardAddr === i2cBoardAddr){
            var relayID = jsonSystemState[dev].relayID;
            var switchValue = jsonSystemState[dev].switchValue;
            relayBoardState = relayBoardState | (switchValue << (relayID-1));
        }
    }
    console.log("getRelayBoardState - I2C board " + i2cBoardAddr + " State is: " + relayBoardState.toString(2));
    return relayBoardState;
}


//******************************************************************************
// Scheduler objects initialization and function job definition.
var schedulerOnJob = [];
var schedulerOffJob = [];
(function initScheduler(){
    for(var dev in jsonSystemState){
        schedulerOnJob[dev] = new cronJob('', null, null, false, null); // Just create the objects.
        schedulerOffJob[dev] = new cronJob('', null, null, false, null); // Just create the objects.
    }
})();
// This is what is going to be executed when the cron time arrive.
function jobAutoOn(dev){
    var boardAddr = jsonSystemState[dev].i2cBoardAddr;
    jsonSystemState[dev].switchValue = 1;

    var relayMask = 1<<(jsonSystemState[dev].relayID-1);
    i2cBoardState[boardAddr] = i2cBoardState[boardAddr] | relayMask;

    var i2CFunctionData = {
        i2cBoardAddr: boardAddr, 
        i2cBoardState: i2cBoardState[boardAddr],
    };
    changeRelayStateQueue.push(i2CFunctionData, function(err){
        if(err) return console.log(timelib.timeNow() + 'Error processing queue element for jobAutoOn(): ' + err);
        console.log(timelib.timeNow() + ' Automatic on: ' + jsonSystemState[dev].name);
    });

    io.sockets.emit('updateClients', jsonSystemState[dev]);
    // Store new values into json file systemState.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function(err){
        if(err) return console.error(err);
    });
}
// This is what is going to be executed when the cron time arrive.
function jobAutoOff(dev){
    var boardAddr = jsonSystemState[dev].i2cBoardAddr;
    jsonSystemState[dev].switchValue = 0;

    var relayMask = 1<<(jsonSystemState[dev].relayID-1);
    i2cBoardState[boardAddr] = i2cBoardState[boardAddr] & (~relayMask);

    var i2CFunctionData = {
            i2cBoardAddr: boardAddr, 
            i2cBoardState: i2cBoardState[boardAddr],
    };
    changeRelayStateQueue.push(i2CFunctionData, function(err){
        if(err) return console.log(timelib.timeNow() + 'Error processing queue element for jobAutoOff(): ' + err);
        console.log(timelib.timeNow() + ' Automatic off: ' + jsonSystemState[dev].name);
    });

    io.sockets.emit('updateClients', jsonSystemState[dev]);
    // Store new values into json file systemState.json
    fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function(err){
        if(err) return console.error(err);
    });
}


//******************************************************************************
// Socket connection handlers
// Listen to changes made from the clients control panel.
function socketConnection(socket){
    var connectIP = socket.client.conn.remoteAddress;
    console.log(timelib.timeNow() + '  IP ' + connectIP + ' connected. Clients count: ' + io.eio.clientsCount);
    socket.on('disconnect', function(){
        var disconnectIP = socket.client.conn.remoteAddress;
        console.log(timelib.timeNow() + '  IP ' + disconnectIP + ' disconnected. Clients count: ' + io.eio.clientsCount);
    });

    // Control WSN page: client request for system state.
    socket.on('reqSystemState', function(){
        // Send jsonSystemState data (BBB pins and xbees) to client at the beginning of connection.
        socket.emit('respSystemState', jsonSystemState); 
    });

    // Vivero control page: listen for changes made by user on browser/client side. Then update system state.
    // Update system state based on clientData values sended by client's browser.
    socket.on('elementChanged', updateSystemState);
    // clientData format is: {'dev':dev, 'switchValue':switchValue, 'autoMode':autoMode, 'autoOnTime':autoOnTime}
    function updateSystemState(clientData){
        var dev = clientData.dev;

        // Store preview system state object. 
        // prevDevState = jsonSystemState[dev] won't work because it store values by reference.
        // Any change later in jsonSystemState will modify prevDevState too.
        var prevDevState = {};
        for(var prop in jsonSystemState[dev]){
    	    prevDevState[prop] = jsonSystemState[dev][prop];
        }

        // Store new values into json file systemState.json.
        jsonSystemState[dev].switchValue = clientData.switchValue;
        jsonSystemState[dev].autoMode = clientData.autoMode;
        jsonSystemState[dev].autoOnTime = clientData.autoOnTime;  // autoOnTime must have a valid value, not undefined.
        jsonSystemState[dev].autoOffTime = clientData.autoOffTime;  // autoOffTime must have a valid value, not undefined.

        var newDevState = jsonSystemState[dev];

        // Update system state. Only the properties that changed with respect to preview state will be modified.
        if((newDevState.switchValue !== prevDevState.switchValue)){
            var relayID = jsonSystemState[dev].relayID;
            var switchState = jsonSystemState[dev].switchValue === 1 ? 'on' : 'off';
            var boardAddr = jsonSystemState[dev].i2cBoardAddr;

            var relayMask = 1<<(relayID-1);
            if(switchState === 'on')    i2cBoardState[boardAddr] = i2cBoardState[boardAddr] | relayMask;
            else    i2cBoardState[boardAddr] = i2cBoardState[boardAddr] & (~relayMask);

            var i2CFunctionData = {
                i2cBoardAddr: boardAddr, 
                i2cBoardState: i2cBoardState[boardAddr],
            };
            changeRelayStateQueue.push(i2CFunctionData, function(err){
                // After processing this element in the queue
                if(err) return console.log('Error sending byte: ' + err);
                console.log(timelib.timeNow() + ' ' + newDevState.name + ' turned ' + switchState + '.');
                //console.log("New relay board state is: " + relayBoardState.toString(2));
            });
            
            /*I2C.changeRelayState(boardAddr, i2cBoardState[boardAddr], function(err){
                if(err) return console.log('Error sending byte: ' + err);

                console.log("I2C board " + boardAddr + " state is: " + i2cBoardState[boardAddr].toString(2));
            });*/
        }
        console.log(timelib.timeNow() + "  Name: " + newDevState.name + 
                    ",  Switch value: " + newDevState.switchValue +
                    ",  AutoMode value: " + newDevState.autoMode +
                    ",  autoOnTime value: " + newDevState.autoOnTime + 
                    ",  autoOffTime value: " + newDevState.autoOffTime);

        // Broadcast new system state to everyone.
        io.emit('updateClients', newDevState);
        // Broadcast new system state to everyone except for the socket that starts it.
        //socket.broadcast.emit('updateClients', newDevState);


        // Start scheduler only if autoMode is 1 (true) and switch value is set to zero (off).
        // Check that autoOnTime is not an empty string or undefined, otherwise server will stop working.
        if(newDevState.autoMode === 1){
            if((newDevState.autoOnTime !== prevDevState.autoOnTime) || (newDevState.autoMode !== prevDevState.autoMode)){
                if((newDevState.autoOnTime !== "") && (newDevState.autoOnTime !== undefined) && (newDevState.autoOnTime !== null)){
                    // Retrieve hours and minutes from client received data.
                    var autoOnTimeSplit = newDevState.autoOnTime.split(":");
                    // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
                    var hourStr = parseInt(autoOnTimeSplit[0], 10).toString();
                    var minuteStr = parseInt(autoOnTimeSplit[1], 10).toString();
        
                    // Set new scheduler values.
                    var onCronTime = new cronTime('0 ' + minuteStr + ' ' + hourStr + ' * * *', null);
                    schedulerOnJob[dev].setTime(onCronTime);
                    // .setCallback is a custom function added by me to the cron lib.
                    schedulerOnJob[dev].setCallback(jobAutoOn.bind(this, dev));   // Set job/function to be execute on cron tick.
                    schedulerOnJob[dev].start();
                    console.log(timelib.timeNow() + ' Set Auto On to: ' + newDevState.autoOnTime + ':00' + '  ' + newDevState.name);
                }
            }
            if((newDevState.autoOffTime !== prevDevState.autoOffTime) || (newDevState.autoMode !== prevDevState.autoMode)){
                if((newDevState.autoOffTime !== "") && (newDevState.autoOffTime !== undefined) && (newDevState.autoOffTime !== null)){
                    // Retrieve hours and minutes from client received data.
                    var autoOffTimeSplit = newDevState.autoOffTime.split(":");
                    // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
                    var hourStr = parseInt(autoOffTimeSplit[0], 10).toString();
                    var minuteStr = parseInt(autoOffTimeSplit[1], 10).toString();
        
                    // Set new scheduler values.
                    var offCronTime = new cronTime('0 ' + minuteStr + ' ' + hourStr + ' * * *', null);
                    schedulerOffJob[dev].setTime(offCronTime);
                    // .setCallback is a custom function added by me to the cron lib.
                    schedulerOffJob[dev].setCallback(jobAutoOff.bind(this, dev));   // Set job/function to be execute on cron tick.
                    schedulerOffJob[dev].start();
                    console.log(timelib.timeNow() + ' Set Auto Off to: ' + newDevState.autoOffTime + ':00' + '  ' + newDevState.name);
                }
            }
        }
        // If auto mode is off.
        else{
            // Enter only if new value of autoMode is different from the previews one.
            if(newDevState.autoMode !== prevDevState.autoMode){
                if(schedulerOnJob[dev] instanceof cronJob) schedulerOnJob[dev].stop();
                if(schedulerOffJob[dev] instanceof cronJob) schedulerOffJob[dev].stop();
            }
        }
        
        var tic = new Date();
        fs.writeFile(jsonFileName, JSON.stringify(jsonSystemState, null, 4), function (err) {
            if(err) console.log(err);
            //else console.log("JSON file saved at " + jsonFileName);
        });
        var toc = new Date();
        //console.log("Operation took " + (toc.getTime() - tic.getTime()) + " ms"); 
    }       // End updateSystemState() function.
}           // End function socketConnection().


//******************************************************************************
// Passport, Express and Routes configuration
var app = require('./app_routes/app');

var server; // server = app.listen(8888);
var io;     // io = require('socket.io')(server);

// First: Initialize all devices in the network to the preview state.
// Second: Initiliaze http server.
// Third: Initialize socket.io.
async.series([
    function(callback){
        console.log('Start devices initialization for I2C board 32');
        i2cBoardState[32] = getRelayBoardState(32);
        // Restore system to its last state.
        I2C.changeRelayState(32, i2cBoardState[32], function(err){
            if(err){
                console.log(err);
                return callback(err);
            }
            console.log('Initialization complete. I2C board  32 state is: ' + i2cBoardState[32].toString(2));
            callback(null);
        });
    },
    function(callback){
        console.log('Start devices initialization for I2C board 33');
        i2cBoardState[33] = getRelayBoardState(33);
        // Restore system to its last state.
        I2C.changeRelayState(33, i2cBoardState[33], function(err){
            if(err){
                console.log(err);
                return callback(err);
            }
            console.log('Initialization complete. I2C board 33 state is: ' + i2cBoardState[33].toString(2));
            callback(null);
        });
    },
    function(callback){
        // Initialize auto on and off schedule.
        for(var dev in jsonSystemState){
           var devState = jsonSystemState[dev];

            if((devState.autoMode === 1) && (devState.autoOnTime !== "") && 
               (devState.autoOnTime !== undefined) && (devState.autoOnTime !== null)){
                // Retrieve hours and minutes from client received data.
                var autoOnTimeSplit = devState.autoOnTime.split(":");
                // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
                var hourStr = parseInt(autoOnTimeSplit[0], 10).toString();
                var minuteStr = parseInt(autoOnTimeSplit[1], 10).toString();

                // Set new scheduler values.
                var onCronTime = new cronTime('0 ' + minuteStr + ' ' + hourStr + ' * * *', null);
                schedulerOnJob[dev].setTime(onCronTime);
                // .setCallback is a custom function added by me to the cron lib.
                schedulerOnJob[dev].setCallback(jobAutoOn.bind(this, dev));   // Set job/function to be execute on cron tick.
                schedulerOnJob[dev].start();
                console.log(timelib.timeNow() + ' Set Auto On to: ' + devState.autoOnTime + ':00' + '  ' + devState.name);
            }
            if((devState.autoMode === 1) && (devState.autoOffTime !== "") && 
               (devState.autoOffTime !== undefined) && (devState.autoOffTime !== null)){
                // Retrieve hours and minutes from client received data.
                var autoOffTimeSplit = devState.autoOffTime.split(":");
                // First convert to integer: "02" -> 2. Then convert to string again: 2 -> "2".
                var hourStr = parseInt(autoOffTimeSplit[0], 10).toString();
                var minuteStr = parseInt(autoOffTimeSplit[1], 10).toString();

                // Set new scheduler values.
                var offCronTime = new cronTime('0 ' + minuteStr + ' ' + hourStr + ' * * *', null);
                schedulerOffJob[dev].setTime(offCronTime);
                // .setCallback is a custom function added by me to the cron lib.
                schedulerOffJob[dev].setCallback(jobAutoOff.bind(this, dev));   // Set job/function to be execute on cron tick.
                schedulerOffJob[dev].start();
                console.log(timelib.timeNow() + ' Set Auto Off to: ' + devState.autoOffTime + ':00' + '  ' + devState.name);
            }
        }
        callback(null);
    },
    function(callback){
        var serverPort = 8888;
        server = app.listen(serverPort, function(error){
            if(error) return callback(error);
            console.log(timelib.timeNow() + ' Server listening on port ' + serverPort + '.');
            callback(null);
        });
    },
    function(callback){
        io = require('socket.io')(server, {
            pingInterval: 7000,
            pingTimeout: 16000,
            transports: ['polling', 'websocket', 'flashsocket', 'xhr-polling']
        });
        io.on('connection', socketConnection);
        console.log(timelib.timeNow() + ' Socket.io is ready.');
        callback(null);
    }],
    function(err){ //This function gets called after all tasks has called its callback functions.
        if(err) return console.error(err);
        console.log(timelib.timeNow() + ' System initialization using async series is complete.');
});