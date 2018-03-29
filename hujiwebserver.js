//hujiwebserver.js:
var net = require("net");
var url = require("url");
var serverParser = require("./hujiServerParser");
const querystring = require("querystring");
var parser = require("./hujiServerParser");

module.exports = {
    commands: [],
    use: function (c, mw) {
        updatdeCommand = ""+c;
        updatdeMw = mw;
        if (arguments.length == 1) {
            updatdeCommand = "/";
            updatdeMw = c;
        }
        this.commands.push({command: updatdeCommand, middleware: updatdeMw});
        return this;
    },
    start: function (port, c) {

        var TIMEOUT = 25000;
        var RES_404_STR = "HTTP/1.1 404 Code not found\nserver-protocol: 404 Not Found\nredirect-status: 404\r\n\r\n"
        this.callback = c;
        var server = net.createServer(function (socket) {

        });

        server.on('connection',function (socket) {
            // creates the vars for the socket on function
            var endOfHeaders_regex = /\r?\n\r?\n/; // Catch 2 \r\n or \n in a row
            var read = "";

            var firstEntrance = true; // indicator for first time getting into socket.on('data')
            var expectingMoreBody = false; // indicator if we expect more body
            var http_req_headers; // the parsed http req headers
            var http_req_body; // the parsed http req body
            var content_len = 0; // the content length according to the header received

            /**
             * Add a callback when the socket receives data.
             */

            socket.on('data', function (data) {


                if (firstEntrance) {
                    // first time entering 'data'
                    // adds the new data chunk to the request
                    read += data;
                } else if (expectingMoreBody) {
                    http_req_body += data;

                    if (req.get("content-length") != undefined) {
                        content_len = req.get("content-length")
                    }

                    if (content_len > http_req_body.length) {
                        // we have more body coming
                        expectingMoreBody = true;
                    } else if (content_len == http_req_body.length) {
                        // finished body
                        expectingMoreBody = false;
                    } else if (content_len < http_req_body.length) {
                        // error. we got more body than we expected
                        //console.log("error. we got more body than we expected.");
                        socket.write("HTTP/1.1 500 Internal Server Error");
                        return;
                    }
                }

                // We will continue waiting to data until we get two
                // end line in a row
                if (endOfHeaders_regex.test(read) && firstEntrance) {

                    firstEntrance = false;
                    http_req_headers = read.split(endOfHeaders_regex)[0];
                    http_req_body = read.split(endOfHeaders_regex)[1];
                    var req = parser.getRequest(http_req_headers);
                    // updating content_len var from headers
                    if (req.get("content-length") != undefined) {
                        content_len = req.get("content-length")
                    }

                    req.body += http_req_body;

                    // checking again if body is in correct size
                    if (content_len > http_req_body.length) {
                        // we have more body coming
                        expectingMoreBody = true;
                    } else if (content_len == http_req_body.length) {
                        // finished body
                        expectingMoreBody = false;
                    } else if (content_len < http_req_body.length) {
                        // error. we got more body than we expected
                        //console.log("error. we got more body than we expected.");
                        socket.write("HTTP/1.1 500 Internal Server Error");
                        return;
                    }

                }

                if (!firstEntrance && !expectingMoreBody) {
                    var res = parser.getResponse(req, socket, this.callback);
                    var next = parser.next();
                    res.path = req.path;
                    try {
                        parser.onData(req, res, next, socket);
                    }
                    catch (e) {
                        console.log("ERROR:" + e.message);
                        //socket.end();
                        //socket.destroy();
                    }
                }


            });

            // socket.on('error', function() {
            //     socket.write("HTTP/1.1 500 Internal Server Error");
            // });
            socket.on('error', function() {
                if (socket.writable) {
                    socket.write("HTTP/1.1 500 Internal Server Error");
                }
            });

            socket.on('close', function() {
                //console.log("socket closed");
            });

            //Set timeout
            socket.setTimeout(TIMEOUT, function(){
                try{
                    if (socket.readyState == 'open')
                    {
                        socket.write(RES_404_STR);
                        socket.end();
                        //socket.destroy();
                        //console.log("socket was closed. no request made for 25 sec")
                    }
                } catch (err)
                {
                    //console.log(err);
                }
            });

        });

        function stop() {
            server.close();
        }

        server.on('error',function(c) {
            c();
        });

        server.listen(port, c);

        return {
            server : server,

            stop : function () {
                server.close();
            }
        };
    }
};
