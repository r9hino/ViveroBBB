// Initialize devices to preview state.
// Turn on/off devices, depending on system state.

var async = require('async');

function initDevices(i2cBoardAddr, i2cBoardState, I2C){
    console.log('Start devices initialization for I2C board ' + i2cBoardAddr);

    // Restore system to its last state.
    I2C.changeRelayState(i2cBoardAddr, i2cBoardState, function(err){
        if(err) return console.log(err);
        console.log('Initialization complete. I2C board ' + i2cBoardAddr + 'state is: ' + i2cBoardState.toString(2));
    });
}

module.exports = initDevices;
    