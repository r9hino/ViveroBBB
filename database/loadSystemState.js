var fs = require('graceful-fs');

// Load to memory the system state from systemState.json file.
// If any error occur trying to load systemState.json file, use default one defined here as jsonWSN.
function loadSystemState(jsonFileName){
    // This json will be loaded only if there doesn't exist an systemState.json file.
    // i.e. if it is the first time running the script, or if systemState.json was previewsly deleted.
    var jsonSystemState = {
        "dev1": {
            "dev": "dev1",
            "relayID": "1",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E1",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev2": {
            "dev": "dev2",
            "relayID":"2",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E2",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev3": {
            "dev": "dev3",
            "relayID":"3",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E3",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev4": {
            "dev": "dev4",
            "relayID":"4",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E4",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev5": {
            "dev": "dev5",
            "relayID":"5",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E5",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev6": {
            "dev": "dev6",
            "relayID":"6",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E6",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev7": {
            "dev": "dev7",
            "relayID":"7",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E7",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev8": {
            "dev": "dev8",
            "relayID":"8",
            "type": "i2c",
            "i2cBoardAddr": 0x20,
            "name": "E8",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev9": {
            "dev": "dev9",
            "relayID":"1",
            "type": "i2c",
            "i2cBoardAddr": 0x21,
            "name": "E9",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
        "dev10": {
            "dev": "dev10",
            "relayID":"2",
            "type": "i2c",
            "i2cBoardAddr": 0x21,
            "name": "E10",
            "switchValue": 0,
            "autoMode": 0,
            "autoOnTime":"",
            "autoOffTime":""
        },
    };

    // Load system state from systemState.json file.
    try{
        // If file exists, initialize states.
        console.log('Loading preview system state...');
        var fileData = fs.readFileSync(jsonFileName);
        jsonSystemState = JSON.parse(fileData);
        console.log("System state loaded successfully.");
    }

    catch(e){
        console.log(e);
        // Here you get the error when the file was not found.
        if (e.code === 'ENOENT'){
            console.log("JSON file doesn't exist. It will be created now...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonSystemState, null, 4));
            console.log("JSON created and saved to " + jsonFileName);
        }
        // File exist but is empty.
        else if(e.code === undefined){
            console.log("File exists but is empty. Using initial configuration...");
            fs.writeFileSync(jsonFileName, JSON.stringify(jsonSystemState, null, 4));
            console.log("JSON saved to " + jsonFileName);
        }
        // Any other error.
        else{
            console.error("Error reading/loading JSON file - " + e.code);
            throw e;
        }
    }

    return jsonSystemState;
}

module.exports = loadSystemState;