var Decode = function() {};



Decode.prototype.checksum = function(chatterdata, counter, packetType, logMessageDecoding, logger, countChecksumMismatch) {


    //make a copy so when we callback the decode method it isn't changing our log output in Winston
    if (logMessageDecoding) logger.silly("Msg# %s   Making sure we have a valid %s packet (matching checksum to actual packet): %s", counter, packetType, JSON.stringify(chatterdata));

    var chatterCopy = chatterdata.slice(0);
    var len = chatterCopy.length;


    var chatterdatachecksum;
    var databytes = 0;

    if (packetType == 'chlorinator') {

        chatterdatachecksum = chatterCopy[len - 3];
        for (var i = 0; i < len - 3; i++) {
            databytes += chatterCopy[i];
        }
        databytes %= 256; //Mod 256 because there is only the lower checksum byte.  No higher (256*x) byte.
    } else {
        //checksum is calculated by 256*2nd to last bit + last bit
        chatterdatachecksum = (chatterCopy[len - 2] * 256) + chatterCopy[len - 1];


        // add up the data in the payload
        for (var i = 0; i < len - 2; i++) {
            databytes += chatterCopy[i];
        }
    }

    var validChatter = (chatterdatachecksum == databytes);
    if (!validChatter) {
        countChecksumMismatch++
        if (logMessageDecoding) {
            if (countChecksumMismatch === 1) {
                logger.silly('Msg# %s  Always get a first mismatch when opening the port.  Ignoring.', counter)
            } else {
                logger.debug('Msg# %s   Packet collision on bus detected. (Count of collissions: %s)', counter, countChecksumMismatch)
                logger.warn('Msg# %s   Mismatch #%s on checksum:   %s!=%s   %s', counter, countChecksumMismatch, chatterdatachecksum, databytes, chatterCopy);

            }
        }

    } else {
        if (logMessageDecoding) logger.silly('Msg# %s   Match on Checksum:    %s==%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    }


    return (validChatter)

};


Decode.prototype.isResponse = function(chatter, counter, packetType, logger, logMessageDecoding, packetFields, queuePacketsArr) {

    if (logMessageDecoding) logger.silly('Msg# %s  Checking to see if inbound message matches previously sent outbound message (isResponse function): %s ', counter, chatter, packetType)


    //For Broadcast Packets
    //Ex set circuit name[255,0,255,165, 10, 16, 32, 139, 5, 7, 0, 7, 0, 0, 1,125]
    //Ex ACK circuit name[255,0,255,165, 10, 15, 16,  10,12, 0,85,83,69,82,78, 65,77,69,45,48,49]


    if (logMessageDecoding) logger.silly('   isResponse:  Msg#: %s  chatterreceived.action: %s (10?) == queue[0].action&63: %s ALL TRUE?  %s \n\n', counter, chatter[packetFields.ACTION], queuePacketsArr[0][7] & 63, ((chatter[packetFields.ACTION] == (queuePacketsArr[0][7] & 63))))

    if (packetType == 'pump') {

        var tempObj = queuePacketsArr[0].slice(3);
        var tempDest = tempObj[2];
        tempObj[2] = tempObj[3];
        tempObj[3] = tempDest;
        if (logMessageDecoding) logger.silly('Msg# %s  Comparing pump message for match: \n                                      Sent: %s  Received: %s \n                                      Method 1 - Swap bytes: sent (%s) to received (%s): %s \n                                      Method 2\3 - ACK or Status: %s to %s: %s ', counter, queuePacketsArr[0], chatter, tempObj, chatter, tempObj.equals(chatter), queuePacketsArr[0][7], chatter[packetFields.ACTION], queuePacketsArr[0][7] == 1 && chatter[packetFields.ACTION] == 1)

        if (tempObj.equals(chatter)) //Scenario 1, pump messages are mimics of each other but the dest/src are swapped
        {
            return (true);

        } else
        //For pump response to set program 1 to 800 RPM
        //                                               0 1  2   3  4  5  6  7 8 9 10 11 12 13 14
        //    17:29:44.943 DEBUG Msg# 8  Msg received: 165,0,16, 96, 1, 2, 3,32,1,59
        //                      Msg written:           255,0,255,165,0,96,16, 1,4,3,39, 3,32, 1,103
        if (queuePacketsArr[0][7] == 1 && chatter[packetFields.ACTION] == 1) //Any commands with <01> are 4 bytes.  The responses are 2 bytes (after the length).  The 3rd/4th byte of the request seem to match the 1st/2nd bytes of the response.
        {
            if (queuePacketsArr[0][11] == chatter[6] && queuePacketsArr[0][12] == chatter[7]) {
                return (true);
            } else {
                return (false)
            }

        }
        //165,0,16,96,7,15,4,0,0,0,0,0,0,0,0,0,0,0,0,17,31,1,95
        //                                                    0 1  2  3   4  5  6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22
        //17:29:41.589 DEBUG Msg# 4  Msg received:          165,0,16, 96, 7,15, 4,0,0,0, 0, 0, 0, 0, 0, 0, 0, 0, 0,17,31, 1,95
        //                           Msg written:           255,0,255,165,0,96,16,7,0,1,28
        else if ((queuePacketsArr[0][7] == 7 && chatter[packetFields.ACTION] == 7)) //Scenario 3.  Request for pump status.
        {
            return (true)
        } else //no match
        {
            return (false)
        }
    } else

    if (packetType == 'chlorinator') {
        /* CHECK FOR RESPONSES
         0=>1
         17=>18
         21=>18
         20=>3*/
        if (chatter[chatter.length - 2] == 16 && chatter[chatter.length - 1] == 3)
        //quick double check here to make sure last two bytes of packet we are matching is 16,3
        {
            if ((queuePacketsArr[0][3] == 0 && chatter[3] == 1) ||
                (queuePacketsArr[0][3] == 17 && chatter[3] == 18) ||
                (queuePacketsArr[0][3] == 21 && chatter[3] == 18) ||
                (queuePacketsArr[0][3] == 20 && chatter[3] == 3)) {
                return (true)
            }
        } else {
            return (false)
        }

    } else

    if (packetType == 'controller') {
        if (chatter[packetFields.ACTION] == 1 && chatter[6] == queuePacketsArr[0][7])
        //if an ACK
        {
            return (true)
        }
        //If a broadcast response to request 202 --> 10
        else if ((chatter[packetFields.ACTION] == (queuePacketsArr[0][7] & 63))) {
            /*this works because:
            There appears to be a relationship between the various Status, Get, and Set messages. It may be that the low order bits designate the type of message and the high order bits control whether or not you are requesting the current status or setting the current values. For example the Date/Time message is type 5(00000101). To request the Date/Time you would set the top two bits resulting in a type of 197(11000101). To set the Date/Time you would set only the topmost bit resulting in a type of 133(10000101). The same seems to apply to many of the other message types.

            see https://github.com/tagyoureit/nodejs-Pentair/wiki/Broadcast
            */

            //the following will additionally check if the custom name (10), circuit (11), or schedule (17) ID match.
            //without this, a request for schedule 1 would match a response for schedule 3 (for example)
            //                             0  1   2   3  4  5   6   7  8  9 10  11
            //example request username:  255  0 255 165  x 16  34 202  1  0  1 181
            //example response           165  x  15  16 10 12   0  85 83 69 82  78 65  77 69 45 48 49 3 219
            if (chatter[packetFields.ACTION] == 10 || chatter[packetFields.ACTION] == 11 || chatter[packetFields.ACTION] == 17) {
                if ((chatter[6]) === queuePacketsArr[0][9]) {
                    return true
                }
                return false
            }

            return (true)
        }
        //Request for Get configuration (252); Response is Send configuration (253)
        else if (chatter[packetFields.ACTION] == 252 && (queuePacketsArr[0][7]) == 253) {
            return (true)
        }
    } else //if we get here, no match
    {
        return (false)
        logger.error('Msg# %s  No match on response.  How did we get here? %s', counter, chatter)
    }

};

Decode.prototype.printStatus = function(data1, data2) {
    var str1 = ''
    var str2 = ''
    var str3 = ''

    str1 = JSON.parse(JSON.stringify(data1));
    if (data2 != null) str2 = JSON.parse(JSON.stringify(data2));
    str3 = ''; //delta
    spacepadding = '';
    spacepaddingNum = 19;
    for (var i = 0; i <= spacepaddingNum; i++) {
        spacepadding += ' ';
    }


    header = '\n';
    header += (spacepadding + '               S       L                                           V           H   P   S   H       A   S           H\n');
    header += (spacepadding + '               O       E           M   M   M                       A           T   OO  P   T       I   O           E\n');
    header += (spacepadding + '           D   U       N   H       O   O   O                   U   L           R   L   A   R       R   L           A                           C   C\n');
    header += (spacepadding + '           E   R   C   G   O   M   D   D   D                   O   V           M   T   T   _       T   T           T                           H   H\n');
    header += (spacepadding + '           S   C   M   T   U   I   E   E   E                   M   E           D   M   M   O       M   M           M                           K   K\n');
    header += (spacepadding + '           T   E   D   H   R   N   1   2   3                       S           E   P   P   N       P   P           D                           H   L\n');
    //                    e.g.  165, xx, 15, 16,  2, 29, 11, 33, 32,  0,  0,  0,  0,  0,  0,  0, 51,  0, 64,  4, 79, 79, 32,  0, 69,102,  0,  0,  7,  0,  0,182,215,  0, 13,  4,186


    //compare arrays so we can mark which are different
    //doing string 2 first so we can compare string arrays
    if (data2 != null || data2 != undefined) {
        for (var i = 0; i < str2.length - 1; i++) {
            if (str1[i] == str2[i]) {
                str3 += '    '
            } else {
                str3 += '   *'
            }
            str2[i] = pad(str2[i], 3);
        }
        str2 = ' New: ' + spacepadding.substr(6) + str2 + '\n'
        str3 = 'Diff:' + spacepadding.substr(6) + str3 + '\n'
    } else {
        str2 = ''
    }


    //format status1 so numbers are three digits
    for (var i = 0; i < str1.length - 1; i++) {
        str1[i] = pad(str1[i], 3);
    }
    str1 = 'Orig: ' + spacepadding.substr(6) + str1 + '\n';

    str = header + str1 + str2 + str3;

    return (str);
}

function pad(num, size) {
    //makes any digit returned as a string of length size (for outputting formatted byte text)
    var s = "   " + num;
    return s.substr(s.length - size);
}

module.exports = new Decode();
