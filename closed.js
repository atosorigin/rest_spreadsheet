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

    var route = null;
    for (var i in routes){
        if (routes[i].matches(path, request.method, i)){ 
            route = routes[i];
            break;
        }
    }
		
    if (route==null){
        console.log("[ERROR] no route found");
        new ErrorViewHTML(response, 404);
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
        
        var q = new Query(request);
        var incidents = Incident.find(q.parameters);
        if (q.format == "xml")
            new IncidentsViewXML(response, incidents, route);
        else
            new IncidentsViewHTML(response, incidents, route);
    },
    show: function(request, response, route){
        debug('Incident.show called');
        var symbol_matches = route.symbol_matches;
        Incident.get_data();
        var o = {};
        o[Incident.field_names[0]] = symbol_matches[0];
        var incidents = Incident.find(o);
        if (is_empty(incidents))
            new ErrorViewHTML(response, 404);
        else{
            var q = new Query(request);
            if (q.format == "xml")
                new IncidentViewXML(response, incidents[symbol_matches[0]]);
            else
                new IncidentViewHTML(response, incidents[symbol_matches[0]]);
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
        get_summary_xml: function(route){
            var r = "<incident>"
            for (var i in this){
                if (i.search("get_") !=0 ){
                    r+= this[i];
                    break;
                }
            }
            r += "</incident>\n";
            return r;
        },
        get_xml: function(route){
            var r = "<incident>\n"
            for (var i in this){
                if (i.search("get_") !=0 ){
                    var element = i.replace(/ /g, "_"); 
                    r+= "<" + element + ">" + this[i] + "</" + element + ">\n";
                }
            }
            r += "</incident>\n";
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

    if(typeof Incident.cache != "undefined")
        return;
    
    Incident.cache = new Object();
    var fs = require("fs");

    data = fs.readFileSync("incidents.csv", "ASCII");
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
    var r = "<thead><tr>";
    for (var i=0; i<Incident.field_names.length;i++)
        r+= "<th>" + Incident.field_names[i] + "</th>";
    return r + "</tr><thead>";
}

function IncidentsViewHTML(response, incidents, route){
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var r = "<html><body><h1>Incidents</h1><table>";
    r += Incident.get_table_header();
    r += "<tbody>";
    for(i in incidents)
        r += incidents[i].get_tr(route);
    r += "</tbody></table></body></html>";
    response.end(r);
}

function IncidentsViewXML(response, incidents, route){
    response.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    var r = "<incidents>";
    for(i in incidents)
        r += incidents[i].get_summary_xml();
    r += "</incidents>";
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
function IncidentViewXML(response, incident){
    response.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    var r = incident.get_xml();
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
    r += "<li><a href='/incidents/INC000000201823?format=xml'>/incidents/INC000000201823?format=xml</a> - a single incident in xml format</li>";
    r += "<li><a href='/incidents?Priority=High&Reported Source=Email'>/incidents?Priority=High&Reported Source=Email</a> - a subset of the incidents</li>";
    r += "<li><a href='/incidents?Priority=High&Reported Source=Email&format=xml'>/incidents?Priority=High&Reported Source=Email&format=xml</a> - a subset of the incidents in xml format</li>";
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
            debug("matches called\n\tfull_path=" + full_path + "\n\tmethod=" + method + "\n\tpattern=" + this.pattern);
			
            this.symbol_matches = new Array();
			
            if(method!=this.method)
                return false;
			
            var symbols_array = new Array();
            for (var i in this.symbols)
                symbols_array[symbols_array.length] = i;
            var symbol_counter = 0;
            var path = full_path;
            var pattern = this.pattern;
            var search_pointer = 0;
            var symbol = null;

            while (path.length){
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

function dump(obj, msg_to_show){
    var msg = "";
    if (typeof msg_to_show != "undefined")
        msg = msg_to_show + "\n";
    
    for(var i in obj)
        msg += "obj[" + i + "]=" + obj[i] + "\n";
    debug(msg, "DUMP");
}

function is_empty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}