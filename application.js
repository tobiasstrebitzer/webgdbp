var library;

$(function() {

    // Initialize library
    library = new GDBp.Library();
    
    // Initialize keyboard
    library.add("keyboard", new GDBp.Keyboard());
    
    // Initialize chruby client
    library.add("chruby", new GDBp.Chruby({
        onConnect: function() {

        },
        onDisconnect: function() {

        }
    }));
    
    // start dbgp server
    library.add("handler", new Socket.Handler({
        address: "127.0.0.1",
        port: 9000,
        onAccept: function(initRequest) {
            
            // Load bookmarks
            library.get("chruby").api("browse", {filename: initRequest.fileuri}, function(browseResult) {
                
                if(browseResult) {
                    // Set browser contents
                    library.get("ui").getBrowserTree().load(browseResult.data);
                    
                    var commands = [];
                    $(browseResult.breakpoints).each(function() {
                        for (var i=0; i < this.lines.length; i++) {
                            commands.push({command: "breakpoint_set", options: {t: "line", f: this.path, n: this.lines[i]} })
                        }
                    });
            
                    if(commands.length > 0) {
                        // Set breakpoints
                        library.get("handler").chain(commands, function() {
                            // Step into execution
                            this.step_into(function() {});
                        });
                    }else{
                        // Step into execution
                        library.get("handler").step_into(function() {});
                    }
                }else{
                    // Step into execution
                    library.get("handler").step_into(function() {});
                }
                

                
            });
       
        }
    }));
    
    chrome.runtime.onSuspend.addListener(function() {
        library.get("handler").shutdown();
        library.get("chruby").shutdown();
    });

    /*  start restarter server (dev)
    library.add("restarter", new Socket.Handler({
        address: "127.0.0.1",
        port: 9001,
        onAccept: function(onAcceptResult) {
            chrome.runtime.reload();
        }
    }));
    */

    // Initialize UI
    library.add("ui", new GDBp.UI());

});

