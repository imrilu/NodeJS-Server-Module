
var url = require("url");
var fs = require("fs");
var hasNext = true;
/**
 * @param read The entire request string from socket
 * @param socket The connection socket
 * @returns {exports} The request object
 */
module.exports.getRequest = function parseRequest(read) {

    var request = {};



    // splitting http request
    read = read.toString().split("\r\n");
    var firstLine = read[0].toString();
    var headers = {};

    //var myurl = url.parse(read[0].toString().split(" ")[1]);
    for (var i = 1; i < read.length; i++) {
        var fieldName = read[i].substr(0,read[i].indexOf(':')).toLowerCase();
        var fieldVal = read[i].substr(read[i].indexOf(' ')+1).toLowerCase();
        headers[fieldName] = fieldVal;
    }


    request.headers = headers;
    request.get = function(name) {
        name = name.toLowerCase();
        return request.headers[name];
    };
    request.body = "";
    //request.body.content_len = request.get("content-length");
    request.cookies = {};
    //TODO: Response Header - Remove from here
    var tempCookie = request.get("set-cookie");
    if (tempCookie != undefined)
    {
        tempCookie = tempCookie.split("=");
        request.cookies[tempCookie[0]] = tempCookie[1];
    }
    tempCookie = request.get("cookie");
    if (tempCookie != undefined)
    {
        tempCookie = tempCookie.split("; ");
        for (cookieStr in tempCookie) {
            keyValueArr = tempCookie[cookieStr].split("=");
            request.cookies[keyValueArr[0]] = keyValueArr[1];
        }

        //TODO:remove - supports only single key=value pair cookie
        // tempCookie = tempCookie.split("=");
        // tempCookie[1] = tempCookie[1].substr(0,tempCookie[1].length-1);
        // request.cookies[tempCookie[0]] = tempCookie[1];
    }
    request.params = {};
    request.host = request.get("host").split(":")[0];
    request.method = firstLine.split(" ")[0];
    request.path = firstLine.split(" ")[1].split("?")[0];
    request.protocol = firstLine.split(" ")[2].split("/")[0].toLowerCase();
    request.query =  {};
    request.firstLine = firstLine;

    //populate query in case of GET request
    if (request.method == "GET") {
        if (firstLine.includes("?")) {
            var tempQuery = firstLine.replace(" HTTP/1.1", "").split("?")[1].split("&");
            for (var i = 0; i < tempQuery.length; i++) {
                var temp = tempQuery[i].replace("+"," ").split("=");    //replace + with space, and split by '='
                                                                        //to get (key,value) pairs
                request.query[temp[0]] = temp[1];
            }
        }
    }
    //Populate query in case of POST request
    if (request.method == "POST") {
        var postParams = request.body.split("&");
        for (var i=0;i<postParams.length;i++)
        {
            var pair = postParams[i].split("=");
            request.query[pair[0]] = pair[1];
        }
    }


    request.param = function(name) {
        //First try to return GET/POST query params
        if (request.query[name] != undefined) {
            return request.query[name];
        }
        //Otherwise return command params
        if (request.params[name] != null) {
            return request.params[name];
        }
    };
    request.is = function(type) {
        // var tempRegex = request.headers["Content-Type"];
        // if (tempRegex.test(type))
        // {
        //     return true;
        // }
        // return false;

        // return request.headers["content-type"].indexOf(type) > 0;
        var content_type = request.headers["content-type"];
        return content_type.includes(type.toLowerCase());
    };


    return request;
};

/**
 * The method to create a next object
 * @returns {exports} The next object
 */
module.exports.next = function next() {
    var next = function () {
        hasNext = true;
    }
    return next;
};

/**
 * The method to create the response object
 * @param req The request object
 * @param socket The connection socket
 * @param callback The callback function to be called at the send function
 * @returns {exports} A response object
 */
module.exports.getResponse = function parseResponse(req, socket,callback) {
    var response = {};
    response.headers = {};

    // checking if fields exist in request obj
    if (req.get("content-length") != undefined) {
        response.headers["Content-Length"] = req.get("content-length");
    }
    if (req.get("content-type") != undefined) {
        response.headers["Content-Type"] = req.get("content-type");
    }
    // checking if content-type is json
    // if (response.headers["Content-Type"] == "application/json") {
    //     //TODO: ERASE
    //     console.log("we got application/json");
    // }

    response.protocol = req.firstLine.split(" ")[2];
    response.statusCode = 0;
    response.socket = socket;
    // timeout delay
    var MW_TIMEOUT = 10000;
    // setting timeout for the socket
    var mwTimeout = setTimeout(function() {
        try{
            if (socket.readyState == 'open') {
                socket.write("HTTP/1.1 404 Code not found\r\n\r\n");
                socket.end();
                //socket.destroy();
                //console.log("socket was closed in mw section. no mw called send()/json() for 10 secs.")
            }
        } catch(e)
        {
            //console.log(e);
        }
    },MW_TIMEOUT);

    response.getStatusMessage = function()
    {
        if (response.statusCode.toString() === "200")
        {
            return "OK";
        } else if (response.statusCode === "404")
        {
            return "Not Found";
        } else if (response.statusCode === "301")
        {
            return "Moved Permanently";
        } else if (response.statusCode === "302")
        {
            return "Moved Temporarily";
        } else if (response.statusCode === "303")
        {
            return "See Other";
        } else if (response.statusCode === "500")
        {
            return "Server Error";
        } else
        {
            return "Code not found";
        }

    };


    response.getFirstLine = function() {
        return response.protocol + " " + response.statusCode + " " + response.getStatusMessage() + "\r\n";
    }
    /**
     * A function to change the response's obj status attribute
     * @param code The new code to be updated to the status
     * @returns {module.exports.getResponse} The response object
     */
    response.status = function (code){
        response.statusCode = code;
        return response;
    };

    /**
     * A function to get an inputted header value from the response header list
     * @param field The key field to return it's val
     * @returns {*} The field's value
     */
    response.get = function (field){
        return response.headers[field];
    };

    /**
     * A function to create and insert the cookie header to the list
     * @param name The name of the cookie
     * @param value The val of the cookie
     * @param options
     */
    response.cookies = function(name, value, options) {
        //TODO: fix the code. extend to support options

        //if (response.headers.length > 1) { //add delimiter if more than one already exists
        //    response.headers["set-cookie"] += " ;" + name + "=" + value;
        //}
        //else {
            response.headers["set-cookie"] = name + "=" + value;
        //}
    };

    /**
     *
     * @param body The body of the response to be written to the socket
     * @returns {*}
     */
    response.json = function(body) {
        //return response.send(JSON.stringify(body));
        return response.send(body);
    };

    /**
     * The set function to set a field-val to the header
     * @param field
     * @param value
     */
    response.set = function (field, value){
        response.headers[field] = value;
    };

    /**
     * Sends the response obj with the body to be written by the socket. calling the callback func and terminating
     * the socket connection
     * @param body Response's body
     */
    response.send = function(body) {
        //Support different file types
        var ext = response.path.split('.').pop();
        var content_type;

        //In case of requesting file, support js,html,css file types only.
        if (response.isFileRequested && (ext == "js" || ext == "html" || ext == "css")) {

            //body = response.path;

            //Set the right content type
            switch(ext) {
                case "js":
                    response.set('Content-Type','application/javascript');
                    response.statusCode = 200;
                    break;
                case "html":
                    response.set('Content-Type','text/html');
                    response.statusCode = 200;
                    break;
                case "css":
                    response.set('Content-Type','text/css');
                    response.statusCode = 200;
                    break;
                default:

            }
            body = fs.readFileSync ("." + response.path).toString();
        }

        content_type = response.headers["Content-Type"];

        //if we recieved an object, stringify it and add appropriate content-type
        if (typeof body == "object") {
            body = JSON.stringify(body);
            response.set("Content-Type", "application/json");
        } else if (content_type != undefined) {
            if (content_type == "application/json" || content_type.includes("application/json")) {
                // body is actually a json string. prasing it correctly
                // removing first and last double quotes
                if (body.charAt(0) == "\"") {
                    body = body.substr(1);
                }
                if (body.charAt(body.length - 1) == "\"") {
                    body = body.substr(0, body.length - 1);
                }
                // removing escape chars (double quotes with slash)
                body = body.replace(/\\"/g, '"');

                //body = JSON.parse(body);
                //body = JSON.stringify(body);
            }
        } else if (content_type == undefined) {
            response.set("Content-Type", "text/html");
        }

        if (body)
        {
            response.set("Content-Length",body.toString().length.toString());
        }

        //Load headers
        var headersStr = "";
        for (var key in response.headers) {
            headersStr += key + ": " + response.headers[key] + "\r\n";
        }
        headersStr += "\r\n";

        if (response.statusCode == 0) {
            response.statusCode = 200;
        }

        //Send headers, and include body if exists
        if (body) {
            response.socket.write(this.getFirstLine() + headersStr + body.toString());
        }
        else {
            response.socket.write(this.getFirstLine() + headersStr);
        }
        // clears mw timeout
        clearTimeout(mwTimeout);
        //run callback and close socket.
        //callback();
        response.socket.end();
        //response.socket.destroy();
    };

    return response;
};

/**
 * The method to go through all mw and match
 * @param req Request obj
 * @param res Response obj
 * @param next Next obj
 */
module.exports.onData = function(req,res,next,socket) {

    //Loop over commands array to find first that matches request's path
    var matchFound = false;
    var server_module = require("./hujiwebserver");
    var cmdarr = server_module.commands;   //get this module's commands array
    for (var i = 0; i < cmdarr.length; i++) {
        if (isMatch(cmdarr[i].command, req.path, req,res)) { 		//Compares command vs path. Updates request param if necessary
            matchFound = true;
            // TODO: check why not recognizing mw call:
            try {
                cmdarr[i].middleware(req, res, next);//invoke middleware, and gets back bool indicating
            }
            catch (e) {
                throw Error("Bad Middleware - " + e.message);
            }
                //if middleware has 'next' call, changing next back to false
            if (!hasNext) {
                // the middleware didnt call next(). stopping loop
                break;
            } else {
                // mw called next so its true now. changing it back to false
                hasNext = false;
            }
        }
    }

    if (!matchFound) {
        if (socket.readyState == 'open') {
            socket.write("HTTP/1.1 404 Code not found\r\n\r\n");
            socket.end();
            //socket.destroy();
            //console.log("no mw matched. closing socket.")
        }
    }


    //This method takes (command,path,request). if there's a match
    function isMatch(command, path, request,response) {

        res.isFileRequested = false;
        command = command + "";     //cast command to string in order to user "indexOf"
        if (command.indexOf("*")>= 0) {         //if we have '*' it means user requests the content of the file
            command.replace("*","");
            res.isFileRequested = true;
        }

        if(command == "/"){
            command = "";
        }

        var replaceSlash = command.replace(/\//g, "\\/");

        //Capture keys on this step
        var keysArr = [];
        var replaceParam = replaceSlash.replace(/\:(\w+)/g, function(key) {
            keysArr.push(key.substring(1));
            return "(\\w+)";
        });

        //var regexToMatch = replaceParam + "(?:\\/[\\w.]+)*(\\?\\w+\\=\\w+(?:\\&\\w+\\=\\w+)*)?$";
        var regexToMatch = "^" + replaceParam +
                            "(?:\\/[\\w.]+)*(?:(?:\\/)|(?:\\?\\w+\\=\\w+(?:\\&\\w+\\=\\w+)*)?)?$";
        //Capture values when using regexToMatch on the given actual path

        var regexPtrn = new RegExp(regexToMatch);
        var match = path.match(regexPtrn);
        if(match != null) {
            for (var i = 0; i < keysArr.length; i++) {
                request.params[keysArr[i]] = match[i + 1];
            }
        }

        return (match != null);
    }

};




