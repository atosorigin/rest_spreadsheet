debug('ReST spreadsheet server startup created by @simondelliott');
var http = require('http');
var PORT = 8080;
//comment for alison 

http.createServer(function (request, response) {
    debug('received a request');
	
    path = require('url').parse(request.url, true).pathname;

    var route = null;
    for (var i in routes){
        if (routes[i].matches( decodeURIComponent(path), request.method, i)){ 
            route = routes[i];
            break;
        }
    }
		
    if (route==null){
        debug("No route found", "ERROR");
        new ErrorViewHTML(response, 404);
    }
    else{
        debug("Route found " + i );
        route.action(request, response, route);
    }
}).listen(PORT);

SiteControler = {
    index: function(request, response, route){
        var v = new SiteViewHTML(response);
    },
    ui_show: function (request, response, route){
        var fs = require("fs");
        data = fs.readFileSync("ui.html", "ASCII");
        new SiteUIViewHTML(response, data);
    }
}

function Query(request){
    debug("Query: request.url=" + request.url);
    var url = require('url').parse(request.url,true)["query"];
    var format = "html";
    var page = 0;
    var args = {};
    for (var i in url){
        debug("query_args[" + i + "]=" + url[i] );
        switch (i){
            case "format":
                format = url[i];
                break;
            case "page":
                page = url[i];
                break;
            default:
               args[i]=url[i];
        }
    }
    debug("format=" + format);
    return{
        format: format,
        page: page,
        parameters: args
    }    
}

IncidentControler = {
    index: function(request, response, route){
        debug('Incident.index called');
        var symbol_matches = route.symbol_matches;
        var ss = symbol_matches[0];
        
        var q = new Query(request);
        var incidents = Incident.find(q.parameters, ss);
        if (q.format == "xml")
            new IncidentsViewXML(response, incidents, route, ss);
        else
            new IncidentsViewHTML(response, incidents, route, ss);
    },
    show: function(request, response, route){
        debug('Incident.show called');
        var symbol_matches = route.symbol_matches;
        var ss = route.symbol_matches_hash.spreadsheet;
        var id = symbol_matches[1];
        Incident.get_data(ss);
        var o = {};
        o[Incident.field_names[0]] = id;
        var incidents = Incident.find(o, ss);
        if (is_empty(incidents))
            new ErrorViewHTML(response, 404);
        else{
            var q = new Query(request);
            if (q.format == "xml")
                new IncidentViewXML(response, incidents[id], route, ss);
            else
                new IncidentViewHTML(response, incidents[id], route, ss);
        }
    }
}

function Incident(fields){
    var o = {
        get_tr: function(route){
            var r = "<tr>"
            var first_column = true;
            for (var i in this){
                if (i.search("get_") !=0 ){
                    r+="<td>" ;
                    if (first_column){
                        r+="<a href='" + route.get_matched_pattern() + "/" + this[i] + "'>" + this[i] + "</a>" ;
                        first_column = false;
                    }
                    else 
                        r+=this[i]
                    r+= "</td>";
                }
            }
            r += "</tr>";
            return r;
        },
        get_summary_xml: function(route){
            var r = "<" + route.symbol_matches_hash.spreadsheet + ">"
            for (var i in this){
                if (i.search("get_") !=0 ){
                    r+= this[i];
                    break;
                }
            }
            r += "</" + route.symbol_matches_hash.spreadsheet + ">\n";
            return r;
        },
        get_xml: function(route){
            var r = "<" + route.symbol_matches_hash.spreadsheet + ">\n"
            for (var i in this){
                if (i.search("get_") !=0 ){
                    var element = i.replace(/ /g, "_"); 
                    r+= "<" + element + ">" + this[i] + "</" + element + ">\n";
                }
            }
            r += "</" + route.symbol_matches_hash.spreadsheet + ">\n";
            return r;
        },
        get_table: function(){
            var r = "<table>"
            for (var i in this)
                if (i.search("get_") !=0)
                    r+="<tr><td>" + i + "</td><td>" + this[i] + "</td></tr>" ;
            r += "</table>";
            return r;
        }
		
    };
    for (var i=0; i<Incident.field_names.length; i++)
        o[Incident.field_names[i]]=fields[i];		
    return o;
}
/* This function was provided by ridgerunner - what a cracking dude
 * http://stackoverflow.com/users/433790/ridgerunner
 * http://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript
 */
function CSVtoArray(text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;
    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        function(m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
};

Incident.get_data = function(ss){

    // enable caching ... uncomment this
    //if(typeof Incident.cache != "undefined")
    //    return;
    
    Incident.cache = new Object();
    var fs = require("fs");

    data = fs.readFileSync("spreadsheets/" + ss + ".csv", "ASCII");
    var lines = data.split("\n");

    if(lines.length<1){
        debug("not enough lines in the file lines.length=" + lines.length, "ERROR");
    }
	
    Incident.field_names = CSVtoArray(lines[0]);

    for (var j=1; j<lines.length; j++){
        var fields = CSVtoArray(lines[j]);
        if(fields.length!=Incident.field_names.length)
            debug("[ERROR]reading line " + j + " fields.length=" + fields.length, "ERROR");
        else
            Incident.cache[fields[0]] = new Incident(fields);
    }
}

Incident.find = function (params, ss){
    Incident.get_data(ss);

    var results = {};
    for (var i in Incident.cache){
        var found = true;
        for (var j in params)
            if ( typeof Incident.cache[i][j] == "undefined" || !Incident.cache[i][j].match(params[j])){
                found = false;
                break;
            }
        if (found)
            results[i] = Incident.cache[i];
    }
    return results;
}

Incident.get_table_header = function (){
    var r = "<thead><tr>";
    for (var i=0; i<Incident.field_names.length;i++)
        r+= "<th>" + Incident.field_names[i] + "</th>";
    return r + "</tr><thead>";
}

function IncidentsViewHTML(response, incidents, route, ss){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>" + ss + "</h1><table>";
    r += Incident.get_table_header();
    r += "<tbody>";
    for(i in incidents)
        r += incidents[i].get_tr(route);
    r += "</tbody></table></body></html>";
    response.end(r);
}

function IncidentsViewXML(response, incidents, route, ss){
    response.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    var r = "<?xml version=\"1.0\"?>\n<" + ss +">";
    for(i in incidents)
        r += incidents[i].get_summary_xml();
    r += "</" + ss + ">";
    response.end(r);
}

function IncidentViewHTML(response, incident, route, ss){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>" + ss + "</h1>";
    r += incident.get_table();
    r += "</body></html>";
    response.end(r);
}
function IncidentViewXML(response, incident, route, ss){
    response.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    var r = "<?xml version=\"1.0\"?>" + incident.get_xml(route);
    response.end(r);
}


function SiteViewHTML(response){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
        
    
    var r = "<html><body><h1>ReST Spreadsheet</h1>";
    r += "<h2>Spreadsheets espressed as a <a href='http://en.wikipedia.org/wiki/Representational_state_transfer'>ReST</a> API</h2>";
    r += "<ul>";
    r += "<li><a href='/cars'>/cars</a> - a list of all the cars</li>";
    r += "<li><a href='/cars/1'>/cars/1</a> - a single car with id 1 (the first column)</li>";
    r += "<li><a href='/cars/1?format=xml'>/cars/1?format=xml</a> - a single car in xml format</li>";
    r += "<li><a href='/cars?Year=1999'>/cars?Year=1999</a> - a subset of the cars</li>";
    r += "</ul>";
    r += "<h2>Example Front End applications that interact with the API</h2>";
    r += "<ul>";
    r += "<li><a href='/ui.html'>Web simple web page</a> - This is a web page that interacts with the API using jQuery and Ajax</li>";
    r += "</ul>";
    r += "<h2>Example spreadsheets that you can use</h2>";
    r += "<ul>";
    var fs = require("fs");
    var examples = fs.readdirSync("spreadsheets", "ASCII");
    for (var i =0; i<examples.length;i++){
        var ss = examples[i];
        ss= ss.substr(0, ss.length - 4);
        r += "<li><a href='/" + ss + "'>" + ss + "</a></li>"
    }
    r += "</ul>";
    r += "</body></html>";
    response.end(r);
}

function SiteUIViewHTML(response, data){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = data;
    response.end(r);
}

function ErrorViewHTML(response, error){
    response.writeHead(error, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>ERROR " + error + "</h1>";
    r += "</body></html>";
    response.end(r);
}

function Route(action, method, pattern, symbols){
    return {
        action: action, // control action that is called when the pattern matches
        method: method, // HTTP method (GET, PUT, POST, DELETE) to match the pattern on
        pattern: pattern, // The pattern to match the request against including any symbols e.g. /invoices/:invoice_number
        symbols: symbols, // The set of symbols to be found in the pattern, as an associative array
        symbol_matches: new Array(), // Array of matched symbols in the order that they appear in the pattern
        symbol_matches_hash: {},
        get_matched_pattern: function(){
            var p = this.pattern;
            for (var i in this.symbols)
                p = p.replace(":" + i, this.symbol_matches_hash[i]);
            return p;
        },		
        matches: function(full_path, method,route_name){
            debug("matches called\n\tfull_path=" + full_path + "\n\tmethod=" + method + "\n\tpattern=" + this.pattern);
            this.symbol_matches = new Array();
			
            if(method!=this.method)
                return false;
			
            var symbols_array = new Array();
            for (var i in this.symbols)
                symbols_array[symbols_array.length] = i;
            var symbol_counter = 0;
            var path = full_path;
            if (path.length>1 && path[path.length-1]=="/")
                path=path.substring(0,path.length-1);
            
            var pattern = this.pattern;
            var search_pointer = 0;
            var symbol = null;

            while (path.length ){
                if (symbol == null){
                    var match_to =0;
                    if(symbol_counter<symbols_array.length){
                        symbol = symbols_array[symbol_counter];
                        symbol_counter++;
                        var j = pattern.search(":" + symbol); //TODO: should always find a symbol, if not error, add error handeling
                        match_to = j;	
                    }
                    else {
                        match_to = pattern.length;
                    }
                    if (match_to==0)
                        return false;

                    var pattern_part_to_match = pattern.substring(0, match_to);
                    var path_part_to_match = path.substring(0, match_to);
					
                    search_pointer = path_part_to_match.search(pattern_part_to_match);
                    if (search_pointer!=0)
                        return false;
                    else{
                        path = path.substring(match_to, path.length);
                        pattern = pattern.substring(match_to,pattern.length);
                    }
                }
                else{
                    var symbol_pattern = this.symbols[symbol];
                    search_pointer = path.search(symbol_pattern);
                    if (search_pointer!=0)
                        return false;
                    else{
                        var matches_array = path.match(symbol_pattern);
                        var match = matches_array[0];
                        this.symbol_matches[this.symbol_matches.length] = match;
                        this.symbol_matches_hash[symbol] = match;
                        path = path.substring(match.length, path.length);
                        pattern = pattern.substring(symbol.length +1,pattern.length);
                    }				
                    symbol = null;
                }
            }

            if (this.symbol_matches.length < symbols_array.length)
                return false;
            else 
                return true;
        }
    }
}

function debug(msg, type){
    if (typeof type =="undefined")
        type = "info";
    console.log("[" + type + "] " + msg);
}

function dump(obj, msg_to_show){
    var msg = "";
    if (typeof msg_to_show != "undefined")
        msg = msg_to_show + "\n";
    
    for(var i in obj){
        msg += "obj[" + i + "]=";
        if (typeof obj[i] == "function")
           msg += "function\n";
        else 
           msg += obj[i] + "\n";
    }
    
    debug(msg, "DUMP");
}

function is_empty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

var routes = {
    ui_show: new Route (SiteControler.ui_show, "GET", "/ui.html"),
    incident_show: new Route(IncidentControler.show, "GET", "/:spreadsheet/:incident_id", {spreadsheet: "[\\w ]+",incident_id: "[\\w ]+"}),
    incident_index: new Route(IncidentControler.index, "GET", "/:spreadsheet", {spreadsheet: "[\\w ]+"}),
    site_index: new Route(SiteControler.index, "GET", "/") 
}
