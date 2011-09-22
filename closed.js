console.log('Closed server startup');
var http = require('http');

http.createServer(function (request, response) {
    console.log('[INFO]received a request');
	
    var routes = {
        incident_show: new Route(IncidentControler.show, "GET", "/incidents/:incident_id", {incident_id: "[\\w ]+"}),
        incident_index: new Route(IncidentControler.index, "GET", "/incidents"),
        site_index: new Route(SiteControler.index, "GET", "/") 
    }

    path = require('url').parse(request.url, true).pathname;

    for (var i in routes){
        if (routes[i].matches(path, request.method, i)){ 
            route = routes[i];
            break;
        }
    }
		
    if (route==null){
        console.log("[ERROR] no route found");
        var v = new ErrorViewHTML(response, 404);
    }
    else{
        console.log("[INFO]route found " + i );
        route.action(request, response, route);
    }
	
}).listen(80);

SiteControler = {
    index: function(request, response, route){
        var v = new SiteViewHTML(response);
    }
}

IncidentControler = {
    index: function(request, response, route){
        var symbol_matches = route.symbol_matches;
        var url = require('url').parse(request.url,true)["query"];
        var query_args = url["query"];
        for (var i in query_args){
            console.log("[INFO]query_args[" + i + "]=" + query_args[i] );
        }
	
        var incidents = Incident.find(require('url').parse(request.url,true)["query"]);
        var v = new IncidentsViewHTML(response, incidents, route);
    },
    show: function(request, response, route){
        var symbol_matches = route.symbol_matches;
        console.log('[INFO]show called');
        Incident.get_data();
        var o = {};
        o[Incident.field_names[0]] = symbol_matches[0];
        var incidents = Incident.find(o);
        var v = new IncidentViewHTML(response, incidents[symbol_matches[0]]);
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
                        r+="<a href='" + route.pattern + "/" + this[i] + "'>" + this[i] + "</a>";
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

function get_fields_from_csv_line(line){
    var l = line.substring(1,line.length-2);
    return l.split('","');
}

Incident.get_data = function(){
    Incident.cache = new Object();
    var fs = require("fs");

    data = fs.readFileSync("closed.csv", "ASCII");
    var lines = data.split("\n");

    if(lines.length<1){
        console.log("[ERROR] not enough lines in the file lines.length=" + lines.length);
    }
	
    Incident.field_names = get_fields_from_csv_line(lines[0]);
	
    for (var j=1; j<lines.length; j++){
        var fields = get_fields_from_csv_line(lines[j]);
        if(fields.length!=Incident.field_names.length)
            console.log("[ERROR]reading line " + j + " fields.length=" + fields.length);
        else
            Incident.cache[fields[0]] = new Incident(fields);
    }
}

Incident.find = function (params){
    if(!Incident.cache)
        Incident.get_data();

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
    var r = "<tr>";
    for (var i=0; i<Incident.field_names.length;i++)
        r+= "<th>" + Incident.field_names[i] + "</th>";
    return r + "</tr>";
}

function IncidentsViewHTML(response, incidents, route){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>Incidents</h1><table>";
    r += Incident.get_table_header();
    for(i in incidents)
        r += incidents[i].get_tr(route);
    r += "</table></body></html>";
    response.end(r);
}

function IncidentViewHTML(response, incident){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>Incident</h1>";
    r += incident.get_table();
    r += "</body></html>";
    response.end(r);
}


function SiteViewHTML(response){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>Pearsons Route to digital</h1>";
    r += "<h2>Incidents espressed as a <a href='http://en.wikipedia.org/wiki/Representational_state_transfer'>ReST</a> API</h2>";
    r += "<ul>";
    r += "<li><a href='/incidents'>/incidents</a> - a list of all the incidents</li>";
    r += "<li><a href='/incidents/INC000000201823'>/incidents/INC000000201823</a> - a single incident</li>";
    r += "<li><a href='/incidents?Priority=High&First Name=Sharon'>/incidents?Priority=High&First Name=Sharon</a> - a subset of the incidents</li>";
    r += "</ul>";
    r += "</body></html>";
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
        action: action,
        method: method,
        pattern: pattern,
        symbols: symbols,
        symbol_matches: new Array(),
        get_pattern: function(){
            var p = this.pattern;
            for (var i in this.symbols)
                p = p.replace(":" + i, this.symbols[i]);

            return p;
        },		
        matches: function(full_path, method,route_name){
            debug("matches called\n\tfull_path=" + full_path + "\n\tmethod=" + method);
			
            this.symbol_matches = new Array();
			
            if(method!=this.method)
                return false;
			
            var symbols_array = new Array();
            for (var i in this.symbols)
                symbols_array[symbols_array.length] = i;
            var symbol_counter = 0;
            var path = full_path;
            var pattern = this.pattern;
			
            debug("path=" + path);
            debug("pattern=" + pattern);
            var search_pointer = 0;

            var symbol = null;
            while (path.length){
                debug("in loop route_name=" + route_name + "\n\tpath.length=" + path.length + "\n\tpath=" + path + "\n\tpattern=" + pattern);
                if (symbol == null){
                    debug("symbol == null");
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
                    debug("match_to=" + match_to );
                    if (match_to==0)
                        return false;

                    var pattern_part_to_match = pattern.substring(0, match_to);
                    var path_part_to_match = path.substring(0, match_to);
					
                    debug("pattern_part_to_match=" + pattern_part_to_match);
                    debug("path_part_to_match=" + path_part_to_match);
					
                    search_pointer = path_part_to_match.search(pattern_part_to_match);
                    debug("search_pointer=" + search_pointer);
                    if (search_pointer!=0)
                        return false;
                    else{
                        path = path.substring(match_to, path.length);
                        pattern = pattern.substring(match_to,pattern.length);
                    }
                }
                else{
                    debug("symbol != null");
					
                    var symbol_pattern = this.symbols[symbol];
                    search_pointer = path.search(symbol_pattern);
                    debug("symbol_pattern=" + symbol_pattern);
                    debug("search_pointer=" + search_pointer);
					
                    if (search_pointer!=0)
                        return false;
                    else{
                        var matches_array = path.match(symbol_pattern);
                        var match = matches_array[0];
                        debug("match=" + match);
                        this.symbol_matches[this.symbol_matches.length] = match;
                        dump(this.matches);
                        path = path.substring(match.length, path.length);
                        pattern = pattern.substring(symbol.length +1,pattern.length);
                    }				
                    symbol = null;
                }
            }
			
            return true;
        }
    }
}

function debug(msg, type){
    if (typeof type =="undefined")
        type = "info";
    console.log("[" + type + "] " + msg);
}

function dump(obj){
    var msg = "";
    for(var i in obj)
        msg += "obj[" + i + "]=" + obj[i] + "\n";
    debug(msg, "DUMP");
}

