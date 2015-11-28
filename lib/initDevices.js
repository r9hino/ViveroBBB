// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

var async = require('async');

function initDevices(jsonSystemState, I2C){
    console.log('Start devices initialization...');


    // Queue manager for changing relay's states.
    var changeRelayStateQueue = async.queue(function(task, callback){
        I2C.changeRelayState(task.i2cBoardAddr, task.relayID, task.state, callback);
    }, 1);

    // Restore devices to last state.
    for(var dev in jsonSystemState){
        var devState = jsonSystemState[dev];
        // If device is connected to an xbee module:
        if(devState.type === 'i2c'){
            if(devState.switchValue === 1)
                changeRelayStateQueue.push({i2cBoardAddr: devState.i2cBoardAddr, relayID: devState.relayID, state: 'on'}, function(err, relayBoardState){
                    if(err) return err;
                    console.log("New relay board state is: " + relayBoardState.toString(2));
                });
            else{
                changeRelayStateQueue.push({i2cBoardAddr: devState.i2cBoardAddr, relayID: devState.relayID, state: 'off'}, function(err, relayBoardState){
                    if(err) return err;
                    console.log("New relay board state is: " + relayBoardState.toString(2));
                });
            }
                
            
            console.log('   Setting up ' + devState.name + ' state.');
        }
    }
    console.log("Devices initialization complete.");
}

module.exports = initDevices;
    