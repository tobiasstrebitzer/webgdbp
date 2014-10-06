var dstream = "";

(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "Buffer": Buffer
        }
    });

    function Buffer(options) {
        var _self = this;
        var _options;
        var _defaults = {};
        var buffer;
        var responses;
        var targetLength;
        
        function feed(data) {
            
            dstream += data;
            
            // Check for multi response
            var dataLines = data.split('\00');
            var results = [];
            var result;
            
            // Loop through lines
            for (var i = 0; i < dataLines.length; i+=1) {
                
                // null string detected or number?
                if(dataLines[i] == "" || isNumber(dataLines[i])) {
                    if(buffer != "") {
                        results.push(processBuffer());
                    }
                }else{
                    // Add to buffer
                    buffer += dataLines[i];
                }
                
            }
            
            // analyze dataLines structure
            /*
            0: "4ZWN1dGlvbjo6c2V0Q2xlYW5FeGl0KCk7Cgo/Pgo=]]></response>"
            1: "272"
            2: "<?xml version="1.0" encoding="iso-8859-1"?>↵<response xmlns="urn:debugger_protocol_v1" xmlns:xdebug="http://xdebug.org/dbgp/xdebug" command="context_names" transaction_id="7"><context name="Locals" id="0"></context><context name="Superglobals" id="1"></context></response>"
            3: ""
            */
            
            // Check if a preceding data row is present
            
            /*
            for (var i = 0; i < dataLines.length; i+=2) {
                var dLength = dataLines[i];
                var dString = dataLines[i+1];
                if(!dString) {
                    // Add continuous buffer
                    result = feedRecord(dLength);
                }else{
                    // Add new message
                    result = feedRecord([dLength, dString].join("\00"));
                }
                
                // Add result if any
                if(result) { results.push(result); }
            }*/
            
            if(results.length > 0) {
                return results;
            }else{
                return false;
            }
            
        }
        
        function isNumber(n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        }
        
        
        function feedRecord(data) {
            buffer += data;
            if(isComplete()) {
                return processBuffer();
            }
            
            return false;
            
        }
        
        function processBuffer() {

            // parse string
            var message = buffer;
            
            // parse xml
            var results = [], parser = new DOMParser();
            var responseXml = parser.parseFromString(message, "text/xml");
            var container = responseXml.firstChild;
            
            // generate response
            var result = convertNodeToObject(container);
            result.type = container.tagName;
            result.origData = message;
            
            buffer = "";
            targetLength = null;

            return result;
        }
        
        
        function convertNodeToObject(node) {
            var object = {};
            // Add attributes
            for(var i=0; i<node.attributes.length; i++) {
                var attribute = node.attributes.item(i);
                if(attribute.name != "xmlns" && attribute.name != "xmlns:xdebug") {
                    object[attribute.name] = attribute.value;
                }
            }
            
            // Add value or children
            if(node.childElementCount == 0) {
                if(node.textContent.length > 0) {
                    if(object.encoding && object.encoding == "base64") {
                        object._value = atob(node.textContent);
                    }else{
                        object._value = node.textContent;
                    }
                }                
            }else{
                object._children = {};
                for(var j=0; j<node.childElementCount; j++ ) {
                    var childnode = node.childNodes[j];
                    if(!object._children[childnode.localName]) {
                        object._children[childnode.localName] = [];
                    }
                    object._children[childnode.localName].push(convertNodeToObject(childnode));
                }
            }

            return object;
        }
        
        function isComplete() {

            if(buffer == "") {return false;}

            // parse string
            var bufferLines = buffer.split('\00');
            
            // what if no size set?
            if(bufferLines.length == 1) {
                buffer = "";
                return false;
            }
            
            targetLength = parseInt(bufferLines[0]);
            var currentData = bufferLines[1];            
            var currentLength = currentData.length;
            
            if (targetLength == currentLength) {
                return true;
            }else{
                return false;
            }
            
        }
        
        function init() {
            $.buffer = _self;
            buffer = "";
            targetLength = null;
            responses = [];
        }
        
        init();

        $.extend(this, {
            "init": init,
            "feed": feed
        });
    }
})(jQuery);



