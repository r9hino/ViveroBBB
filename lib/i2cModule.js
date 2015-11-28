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
    
    i2c1 =  i2c.openSync(i2cBusBBB); // point to your i2c address, debug provides REPL interface 
    
    //this.i2cBus = i2c;
}


//******************************************************************************
// Change specific relay state on/off.
I2C.prototype.changeRelayState = function(i2cBoardAddr, relayID, state, callback){
    
    // Convert relayID number to the corresponding bit mask.
    // If relayID = 3 -> relayMask = 0b0100
    var relayMask = 1<<(relayID-1);
    
    // Get relay board state -> 00001111    
    i2c1.receiveByte(i2cBoardAddr, function(err, relayBoardState){
        if(err) return err;
        
        relayBoardState = ~relayBoardState;
        
        if(state === 'on'){
            relayBoardState = relayBoardState | relayMask;
        }
        // If state is 'off'.
        else{
            // Only if relay is on, turn it off.
            if(relayBoardState & relayMask)
                relayBoardState = relayBoardState ^ relayMask;
        }
        
        // Write new relay board state.
        relayBoardState = ~relayBoardState;
        i2c1.sendByte(i2cBoardAddr, relayBoardState, function(err){
            if(err)  return callback(err, relayBoardState);
            callback(null, relayBoardState);
        });
    });
};


module.exports = I2C;