/*
Configure Bootstrap Panels, in 2 steps ...
   1) Enable / Disable panels as configured (in json file)
   2) Load Panel Sequence from Storage (as saved from last update)
*/
function configPanels(jsonPanel) {
	//Enable / Disable panels as configured (in json file)
	for (var currPanel in jsonPanel) {
		if (jsonPanel[currPanel]["state"] === "visible")		
			$('#' + currPanel).show();
		else
			$('#' + currPanel).hide();
		// Debug Panel -> Update Debug Log Button
		if (currPanel == "debug") {
			if (jsonPanel[currPanel]["state"] === "visible")
				setStatusButton($('#debugEnable'), 'Debug Log: On');
			else
				setStatusButton($('#debugEnable'), 'Debug Log: Off');
		}
	}

	// Load Panel Sequence from Storage (as saved from last update)
	if (typeof(Storage) !== "undefined") {
		var panelIndices = JSON.parse(localStorage.getItem('panelIndices'));
		// Make sure list loaded from Storage is not empty => if so, just go with default as in index.html
		if (panelIndices) {
			var panelList = $('#draggablePanelList');
			var panelListItems = panelList.children();
			// And, only reorder if no missing / extra items => or items added, removed ... so "reset" to index.html
			if (panelIndices.length == panelListItems.length) {
				panelListItems.detach();
				$.each(panelIndices, function() {
					var currPanel = this.toString();
					var result = $.grep(panelListItems, function(e){ 
						return e.id == currPanel;
					});
					panelList.append(result);
				});
			}
		}
	} else {
		$('#txtDebug').append('Sorry, your browser does not support Web Storage.' + '<br>');
	}	
};

/*
Routine to recursively parse Equipment Configuration, setting associated data for DOM elements 
*/
function dataAssociate(strControl, varJSON) {
	for (var currProperty in varJSON) {
		if (typeof varJSON[currProperty] !== "object") {
			$('#' + strControl).data(currProperty, varJSON[currProperty]);
		} else {
			if (Array.isArray(varJSON)) {
				dataAssociate(strControl, varJSON[currProperty]);								
			} else {
				dataAssociate(currProperty, varJSON[currProperty]);				
			}
		}
	}
}

function dayOfWeekAsInteger(strDay) {
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(strDay.capitalizeFirstLetter(strDay));
}

function dayOfWeekAsString(indDay) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][indDay];
}

function fmtScheduleTime(strInpStr) {
	splitInpStr = strInpStr.split(":");
	if (splitInpStr[0] < 12)
		strAMPM = 'am';
	else
		strAMPM = 'pm';
	strHours = (parseInt(splitInpStr[0]) % 12).toFixed(0);
	strMins = ('0' + parseInt(splitInpStr[1])).slice(-2);
	return strHours + ':' + strMins + ' ' + strAMPM;
}

function setStatusButton(btnID, btnState) {
	if (btnState.toUpperCase().includes('ON')) {
		btnID.removeClass('btn-primary');
		btnID.addClass('btn-success');
	} else {
		btnID.removeClass('btn-success');
		btnID.addClass('btn-primary');
	}
	btnID.html(btnState.capitalizeFirstLetter());
}

function buildDaysButtons(strDays) {
	var arrDays = Array(7).fill(false);
	splitDays = strDays.split(" ");
	for (var currDay of splitDays) {
		if (currDay !== "")
			arrDays[dayOfWeekAsInteger(currDay)] = true;
	}
	strHTML = '';
	for (var iterDay in arrDays) {
		strCurrDay = dayOfWeekAsString(iterDay);
		if (arrDays[iterDay] === true) {
			strHTML += '<button class="btn btn-success btn-xs" id="' + strCurrDay + '">';
		} else {
			strHTML += '<button class="btn btn-default btn-xs" id="' + strCurrDay + '">';	
		}
		strHTML += strCurrDay + '</button>';
	}
	return strHTML;
}

function formatLog(strMessage) {
	// Colorize Message, in HTML format
	var strSplit = strMessage.split(' ');
	var strColor = logColors[strSplit[1].toLowerCase()];
	if (strColor) {
		strSplit[1] = strSplit[1].fontcolor(strColor).bold();
	}
	
	// And output colorized string to Debug Log (Panel)
	$('#txtDebug').append(strSplit.join(' ') + '<br>');
	$("#txtDebug").scrollTop($("#txtDebug")[0].scrollHeight);
}

String.prototype.capitalizeFirstLetter = function() {
	return this.charAt(0).toUpperCase() + this.toLowerCase().slice(1);
}

String.prototype.toTitleCase = function() {
	return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

// From http://api.jquery.com/jquery/#jQuery3
// JQuery(callback), Description: Binds a function to be executed when the DOM has finished loading
$(function () {
    // Initialize variables
	var $hideAUX = true;
    var socket = io();

	// Set up draggable options => allow to move panels around
	var panelList = $('#draggablePanelList');
	panelList.sortable({
		// Only make the .panel-heading child elements support dragging.
		// Omit this to make then entire <li>...</li> draggable.
		handle: '.panel-heading', 
		update: function() {
			var panelIndices = [];
			panelList.children().each(function() {
				panelIndices[$(this).index()] = $(this).attr('id');
			});	
			localStorage.setItem('panelIndices', JSON.stringify(panelIndices));
		}
	});	

	// Load configuration (from json), process once data ready
	$.getJSON('configClient.json', function(json) {
		// Configure panels (visible / hidden, sequence)
		configPanels(json.panelState);
		// Call routine to recursively parse Equipment Configuration, setting associated data for DOM elements 
		dataAssociate("base", json.equipConfig);
		// Log test colorization => no var in front, so global
		logColors = json.logLevels;
	});

	// Button Handling: Pool, Spa => On/Off
    $('#poolState, #spaState').on('click', 'button', function () {
        setEquipmentStatus($(this).data($(this).attr('id')));
    })
	
	// Button Handling: Pool / Spa, Temperature SetPoint
    $('#poolSetpoint, #spaSetpoint').on('click', 'button', function () {
		setHeatSetPoint($(this).data('equip'), $(this).data('adjust'));
    })

	// Button Handling: Pool / Spa, Heater Mode
    $('#poolHeatMode, #spaHeatMode').on('click', 'button', function () {
		var currButtonPressed = $(this).attr('id');
        if (currButtonPressed.includes('HeatMode')) {
			var strHeatMode = currButtonPressed.slice(0, currButtonPressed.indexOf('HeatMode')) + 'HeatMode';
			var currHeatMode = $('#' + strHeatMode).data(strHeatMode);
			var newHeatMode = (currHeatMode + 4 + $(this).data('heatModeDirn')) % 4;
			setHeatMode($('#' + strHeatMode).data('equip'), newHeatMode)
		}
    })

	// Button Handling: Features => On/Off
    $('#features').on('click', 'button', function () {
        setEquipmentStatus($(this).data($(this).attr('id')));
    })
	
	// Button Handling: Debug Log => On/Off
    $('#debugEnable').click(function () {
		if ($('#debug').is(":visible") == true) {
			$('#debug').hide();
			setStatusButton($('#debugEnable'), 'Debug Log: Off');
		} else {
			$('#debug').show();
			setStatusButton($('#debugEnable'), 'Debug Log: On');
		}
    })
	
    // Socket Events (Emit)
    function setHeatSetPoint(equip, change) {
        socket.emit('setHeatSetPoint', equip, change)
    }

    function setHeatMode(equip, change) {
        socket.emit('setHeatMode', equip, change)
    }

    function setEquipmentStatus(equipment) {
        if (equipment != undefined)
			socket.emit('toggleCircuit', equipment)
		else
			formatLog('ERROR: Client, equipment = undefined')
	};

    // Socket Events (Receive)
    socket.on('circuit', function (data) {
        showCircuit(data);
    });

    socket.on('config', function (data) {
        showConfig(data);
    });

    socket.on('pump', function (data) {
        showPump(data);
    })

    socket.on('heat', function (data) {
        showHeat(data);
    })

    socket.on('schedule', function (data) {
        showSchedule(data);
    })
	
    socket.on('outputLog', function (data) {
		formatLog(data);
    })	

	// Show Information (from received socket.io)
    function showPump(data) {
        $('#pump1').html(data[1].name + '<br>Watts: ' + data[1].watts + '<br>RPM: ' + data[1].rpm + '<br>Error: ' + data[1].err + '<br>Mode: ' + data[1].mode + '<br>Drive state: ' + data[1].drivestate + '<br>Run Mode: ' + data[1].run)
        $('#pump2').html(data[1].name + '<br>Watts: ' + data[2].watts + '<br>RPM: ' + data[2].rpm + '<br>Error: ' + data[2].err + '<br>Mode: ' + data[2].mode + '<br>Drive state: ' + data[2].drivestate + '<br>Run Mode: ' + data[2].run)
    }

    function showConfig(data) {
        if (data != null) {
            $('#currTime').html(data.time);
            $('#airTemp').html(data.airTemp);
            $('#solarTemp').html(data.solarTemp);
            $('#runMode').html(data.runmode);
            $('#stateHeater').html(data.HEATER_ACTIVE);
            $('#poolCurrentTemp').html(data.poolTemp);
            $('#spaCurrentTemp').html(data.spaTemp);
        }
    }

    function showSchedule(data) {
		for (var currSchedule of data) {
			if (currSchedule == null) {
				//console.log("Schedule: Dataset empty.")
			} else {
				if (currSchedule.MODE === "Schedule") {
					// Schedule Event
					if (currSchedule.CIRCUIT !== 'NOT USED') {
						schName = 'schItem' + currSchedule.ID;
						schHTML = '<tr name="' + schName + '" id="' + schName +'"><td>' + currSchedule.ID + '</td>' + '<td>' + currSchedule.CIRCUIT.capitalizeFirstLetter() + '</td>' +
							'<td>' + fmtScheduleTime(currSchedule.START_TIME) + '</td>' + '<td>' + fmtScheduleTime(currSchedule.END_TIME) + '</td>' + '<td>' + buildDaysButtons(currSchedule.DAYS) + '</td></tr>'
						if (document.getElementById(schName)) {
							$(schName).html(schHTML);
						} else {
							$('#schedules tr:last').after(schHTML);
						}
					}
				} else {
					// EggTimer
				}
			}
        }
    }

    function showHeat(data) {
        $('#poolHeatSetPoint').html(data.poolSetPoint);
        $('#poolHeatMode').data('poolHeatMode', data.poolHeatMode)
		$('#poolHeatModeStr').html(data.poolHeatModeStr);
        $('#spaHeatSetPoint').html(data.spaSetPoint)
        $('#spaHeatMode').data('spaHeatMode', data.spaHeatMode)
		$('#spaHeatModeStr').html(data.spaHeatModeStr);
    }

    function showCircuit(data) {
	for (var currCircuit of data) {
            if (currCircuit.hasOwnProperty('name')) {
                if (currCircuit.name != "NOT USED") {
					if (document.getElementById(currCircuit.name)) {
						setStatusButton($('#' + currCircuit.name), currCircuit.status);
						$('#' + currCircuit.name).data(currCircuit.name, currCircuit.number)															
					} else if (document.getElementById(currCircuit.numberStr)) {
						setStatusButton($('#' + currCircuit.numberStr), currCircuit.status);
						$('#' + currCircuit.numberStr).data(currCircuit.numberStr, currCircuit.number)															
					} else if (($hideAUX === false) || (currCircuit.name.indexOf("AUX") === -1)) {
						$('#features tr:last').after('<tr><td>' + currCircuit.name.toLowerCase().toTitleCase() + '</td><td><button class="btn btn-primary btn-xs" name="' + currCircuit.numberStr + '" id="' + currCircuit.numberStr + '">---</button></td></tr>');
						setStatusButton($('#' + currCircuit.numberStr), currCircuit.status);
						$('#' + currCircuit.numberStr).data(currCircuit.numberStr, currCircuit.number)															
					}
                }
            }
        }
    }		
});