// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

function initDevices(jsonSystemState, I2C){
    console.log('Start devices initialization...');

    // Restore devices to last state.
    for(var dev in jsonSystemState){
        var devState = jsonSystemState[dev];
        // If device is connected to an xbee module:
        if(devState.type === 'i2c'){
            if(devState.switchValue === 1)
                I2C.changeRelayState(devState.i2cBoardAddr, devState.relayID, 'on', function(err, relayBoardState){
                    if(err) return err;
                    console.log("New relay board state is: " + relayBoardState.toString(2));
                });
            else{
                I2C.changeRelayState(devState.i2cBoardAddr, devState.relayID, 'off', function(err, relayBoardState){
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
    