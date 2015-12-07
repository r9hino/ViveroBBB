/*
    Client side script for handling WSN devices.
*/

$(document).on("pagecreate", function(){
    // Jquery variables.
    var $controlPanel = $('#controlPanel');
    var $connectionStatus = $('#connectionStatus');

    // Global variables.
    var guiActiveTime = 3*60*1000;  // Miliseconds.
    var timerTimeout = null;

    // Store URL of the address bar.
    var barURL = document.location.href;
    // Connect to the server based on the URL address.
    // If local connection is available client can try to connect to 192.168.7.2:8888.
    // If a remote connection is request, client can try to connect using vivero.mooo.com:8888.
    var socket = io.connect(barURL,{
        forceNew: true,
        rememberUpgrade: true,
        transports: ['xhr-polling', 'websocket', 'flashsocket', 'polling']
    });

    console.time('connection');    
    // Each time client connects/reconnects, toggle grayed GUI.
    socket.on('connect',function(){
        console.timeEnd('connection');
        console.log('Connect socket status: ', socket.io.engine);
        
        // Enable graphical user interface GUI.
        enableGUI();
        
        // Update system state.
        socket.emit('reqSystemState');
        socket.on('respSystemState', function(jsonSystemState){
            $controlPanel.empty();  // Empty the div.
    
            for(var dev in jsonSystemState){
    		    var name = jsonSystemState[dev].name;
    		    var switchValue = jsonSystemState[dev].switchValue;
    		    var autoMode = jsonSystemState[dev].autoMode;
    		    var autoOnTime = jsonSystemState[dev].autoOnTime;
    		    var autoOffTime = jsonSystemState[dev].autoOffTime;
    
    		    // Create buttons based on the system state.
    		    $controlPanel.append(
                '<div class="ui-field-contain ui-responsive">\
                    <label class="device-label" for="'+dev+'switch">'+name+'</label>\
                    <input type="checkbox" class="dynamic" name="'+dev+'" id="'+dev+'switch" data-role="flipswitch" data-mini="true"/>\
                    <div class="horizontal-checkbox">\
                        <label for="'+dev+'checkbox">Auto</label>\
                        <input type="checkbox" class="dynamic" name="'+dev+'" id="'+dev+'checkbox" data-mini="true"/>\
                    </div>\
                    <div  class="horizontal-time">\
                        <div data-role="fieldcontain">\
                            <label>On</label>\
                            <input type="time" class="dynamic" name="'+dev+'" id="'+dev+'ontime" value="" data-clear-btn="false"/>\
                            <br><br>\
                            <label>Off</label>\
                            <input type="time" class="dynamic" name="'+dev+'" id="'+dev+'offtime" value="" data-clear-btn="false"/>\
                        </div>\
                    </div>\
                </div>'
    			);
    			$controlPanel.trigger('create');
    			updateDynamicallyAddedButtons(dev, switchValue, autoMode, autoOnTime, autoOffTime);
    		}
        });
    });
    /*'<div class="ui-field-contain ui-responsive">\
                    <fieldset data-type="horizontal">\
        <legend>Horizontal controlgroup, mixed:</legend>\
        <a href="#" class="ui-shadow ui-btn ui-corner-all ui-icon-arrow-r ui-btn-icon-right">Link</a>\
        <button class="ui-shadow ui-btn ui-corner-all ui-icon-grid ui-btn-icon-notext">Button</button>\
        <label for="select-v-1e">Select</label>\
        <select name="select-v-1e" id="select-v-1e">\
            <option value="#">One</option>\
            <option value="#">Two</option>\
            <option value="#">Three</option>\
        </select>\
    </fieldset>\
                </div>'
    '<div class="ui-field-contain ui-responsive">\
                    <label for="'+dev+'switch">'+name+'</label>\
                    <input type="checkbox" class="dynamic" name="'+dev+'" id="'+dev+'switch" data-role="flipswitch"/>\
                    <div class="horizontal-checkbox">\
                        <label for="'+dev+'checkbox">Auto</label>\
                        <input type="checkbox" class="dynamic" name="'+dev+'" id="'+dev+'checkbox" data-mini="true"/>\
                    </div>\
                    <div class="horizontal-time inline">\
                        <label>On</label>\
                        <input type="time" class="dynamic" name="'+dev+'" id="'+dev+'ontime" value="" data-clear-btn="false"/>\
                    </div>\
                    <div class="horizontal-time">\
                        <input type="time" class="dynamic" name="'+dev+'" id="'+dev+'offtime" value="" data-clear-btn="false"/>\
                    </div>\
                </div>'
                */

    /* Send data to server.
        Use .on() method when working with dynamically created buttons.
        Handles clicks/changes events and send new states to the server.*/
    $controlPanel.on('change', '.dynamic', changeHandler);
    function changeHandler(e){
        // "this" correspond to the input checkbox clicked/changed.
        var dev = $(this).prop('name');    // Retrieve device Id.
        var switchValue = $('#'+dev+'switch').prop('checked') ? 1 : 0;  // If switch is on set switchValue to 1.
        var autoMode = $('#'+dev+'checkbox').prop('checked') ? 1 : 0;   // If checked is true set value to 1.
        var autoOnTime = $('#'+dev+'ontime').val();
        var autoOffTime = $('#'+dev+'offtime').val();

        // Send button state to server.
        var devObj = {'dev':dev, 'switchValue':switchValue, 'autoMode':autoMode, 'autoOnTime':autoOnTime, 'autoOffTime':autoOffTime};
        console.log('This client data: ', devObj)
        socket.emit('elementChanged', devObj);
    }


    /* Receive data from server.
        Update client control panel do to changes in others client's control panel.
        Also used as feedback from the server. Client --> Server --> Client.
        Client send new states to server, and if server did the work, it send back
        again the system state values as a confirmation procedure.*/
    socket.on('updateClients', function(serverData){
        console.log("Data from server: ", serverData);
        var dev = serverData.dev;
        var switchValue = serverData.switchValue;
        var autoMode = serverData.autoMode;
        var autoOnTime = serverData.autoOnTime;
        var autoOffTime = serverData.autoOffTime;

        updateDynamicallyAddedButtons(dev, switchValue, autoMode, autoOnTime, autoOffTime);
    });


    // Update buttons status (colors) based on system state.
    function updateDynamicallyAddedButtons(dev, switchValue, autoMode, autoOnTime, autoOffTime){
        // To avoid re-executing event handler .on() 'change', changeHandler function is turned off
        // when control panel data arrive from server side.
        $controlPanel.off('change', '.dynamic', changeHandler);

        // Turn on or off switch checkbox.
        if (switchValue === 1)  $('#'+dev+'switch').prop("checked",true).flipswitch("refresh");
        else  $('#'+dev+'switch').prop("checked",false).flipswitch("refresh");

        // Check or uncheck Auto Mode checkbox.
		if (autoMode === 1) $('#'+dev+'checkbox').prop("checked",true).checkboxradio("refresh");
		else $('#'+dev+'checkbox').prop("checked",false).checkboxradio("refresh");

		// Update on time picker.
		$('#'+dev+'ontime').val(autoOnTime);
		// Update off time picker.
		$('#'+dev+'offtime').val(autoOffTime);

		// Reactivate on 'change' event handler. This way we avoid reentering to 
		// on 'change' event handler after each 'refresh'. Event handler must be 
		// execute only by manually actions an not due to program actions, like when refreshing.
		$controlPanel.on('change', '.dynamic', changeHandler);
    }

    // Update connection status.
    $(window).on('click', function(){
        // If control panel is disabled, clicking in grayed background return connection to server.
        if($controlPanel.hasClass('ui-state-disabled')){
            $connectionStatus.text('Reconnecting');
		    $connectionStatus.css('color', '#2356e1');
            socket.io.connect();
        }
        // If control panel is available, then each click reset setTimeout's timer.
        // I.E. disconnection will occur # seconds after last click.
        else{
            clearTimeout(timerTimeout);
            timerTimeout = null;
            // Reset disconnection time 'guiActiveTime' seconds.
            timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
        }
    });
    //$(window).on('blur', windowBlur);
    $(window).on('focus', windowFocus);
    
    // Phone Chrome doesn't detect .blur() events, others browsers do. Waiting for some patches.
    function windowBlur(){
        // Clear timer to avoid another disconnection on timeout.
        clearTimeout(timerTimeout);
        timerTimeout = null;
        // On window losing focus, disconnect from server.
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. It will be re-enable in reconnection.
        $controlPanel.addClass('ui-state-disabled');
    }
    
    function windowFocus() {
        // If control panel is disabled, focus will try to reconnect.
        if($controlPanel.hasClass('ui-state-disabled')){
            $connectionStatus.text('Reconnecting');
		    $connectionStatus.css('color', '#2356e1');
            socket.io.connect();
        }
    }
    
    function enableGUI(){
        // Update connection status.
        $connectionStatus.text('Online');
		$connectionStatus.css('color', 'green');
        // When connection is established, enable all control elements if previously disabled.
        $controlPanel.removeClass("ui-state-disabled");

        // Disconnect from server after 'guiActiveTime' seconds. Reconnection occurs when user clicks on grayed background.        
        timerTimeout = null;
        timerTimeout = setTimeout(disconnectOnTimeout, guiActiveTime);
    }
    
    // Reasons: 'ping timeout', 'forced close', 'transport close'
    socket.on('disconnect', function(reason){
        $connectionStatus.text('Offline ' + reason);
		$connectionStatus.css('color', 'red');
		console.log('Disconnect socket status: ', socket);
    });
    
    function disconnectOnTimeout(){
        // Close connection after # seconds.
        socket.io.disconnect();
        // Disable all control panel input elements. Grayed background. Re-enable it in reconnection.
        $controlPanel.addClass('ui-state-disabled');
    }
});
