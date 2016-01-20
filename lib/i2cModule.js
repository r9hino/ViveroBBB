/*
    This module will:
        - Initial configuration for the i2c module.
        - Store i2c's module addresses.
        - All functions framework based on i2c-bus module.
*/

var i2c = require('i2c-bus');
var i2c1;

// Private variables.
var i2cBusBBB = 1;

// Constructor High-Level Framework for I2C.
function I2C(i2cBus){
    
    i2c1 =  i2c.openSync(i2cBusBBB); // point to your i2c address bus 1.

}


//******************************************************************************
// Change specific relay state on/off.
I2C.prototype.changeRelayState = function(i2cBoardAddr, i2cBoardState, callback){

    // Write new relay board state.
    i2cBoardState = ~i2cBoardState;
    i2c1.sendByte(i2cBoardAddr, i2cBoardState, function(err){
        if(err)  return callback(err, i2cBoardState);
        return callback(null, i2cBoardState);
    });
};


module.exports = I2C;