chrome.app.runtime.onLaunched.addListener(function() {

    chrome.app.window.create('application.html', {
        "frame": "none",
        "bounds": {
            "left": 0,
            "top": 0,
            "width": 580,
            "height": 500
        },
        "minWidth": 300,
        "minHeight": 300
    });
        
});
