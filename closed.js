console.log('Closed server startup');
var http = require('http');

http.createServer(function (request, response) {
	console.log('[INFO]received a request');
	
	var routes = {
		incident_index: new Route("IncidentControler", IncidentControler.index, "GET", "/incidents"), 
		incident: new Route("IncidentControler", IncidentControler.show, "GET", "/incidents/:incident_id", {incident_id: "[\w ]+"}),
	}
	
	var route = null;
	for (var i in routes)
		if (routes[i].matches(request.url, request.method)){ 
			route = routes[i];
			break;
		}
	
	if (route==null)
		console.log("[ERROR] no route found");
	else{
		//console.log("[INFO]route found " + i +"\n\tcontroler=" + route.controler + "\n\taction=" + route.action);
		console.log("[INFO]route found " + i );
		console.log("\ttypeof action=" + typeof route.action);
		
		route.action(request, response);
	}
	
	//var ic = new IncidentControler(request, response);
	//ic.index();
	
}).listen(80);

/*
function IncidentControler(request, response){
	console.log('IncidentControler instanciated');
	return{
		response: response,
		request: request,
		index: function(){
			
			var url = require('url').parse(request.url,true)["query"];
			var query_args = url["query"];
			for (var i in query_args){
				console.log("[INFO]query_args[" + i + "]=" + query_args[i] );
			}
		
			var incidents = Incident.find(require('url').parse(request.url,true)["query"]);
			var v = new IncidentsViewHTML(this.response, incidents);
		},
		show: function(){
			console.log('[INFO]show called');
		}
	}
}
*/
IncidentControler = {
	index: function(request, response){
		var url = require('url').parse(request.url,true)["query"];
		var query_args = url["query"];
		for (var i in query_args){
			console.log("[INFO]query_args[" + i + "]=" + query_args[i] );
		}
	
		var incidents = Incident.find(require('url').parse(request.url,true)["query"]);
		var v = new IncidentsViewHTML(response, incidents);
	},
	show: function(request, response){
		console.log('[INFO]show called');
	}
}

function Incident(fields){
	var o = {
		get_tr: function(){
			var r = "<tr>"
			for (var i in this)
				if (i != "get_tr")
					r+="<td>" + this[i] + "</td>";
			r += "</tr>";
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

function IncidentsViewHTML(response, incidents){
	response.writeHead(200, {'Content-Type': 'text/html'});
	var r = "<html><body><h1>Incidents</h1><table>";
	r += Incident.get_table_header();
	for(i in incidents)
		r += incidents[i].get_tr();
	r += "</table></body></html>";
	response.end(r);
}

function Route(controler, action, method, pattern, symbols){
	return {
		controler: controler,
		action: action,
		method: method,
		pattern: pattern,
		symbols: symbols,
		matches: new Array(),
		get_pattern: function(){
			var p = this.pattern;
			for (var i in this.symbols)
				p = p.replace(i, this.symbols[i]);

			return p;
		},		
		matches: function(url, method){
			console.log("[INFO] matches called\n\turl=" + url + "\n\tmethod=" + method);
			
			if(method!=this.method)
				return false;
				
			var p = this.get_pattern();
			console.log("\tpattern=" + p );
			
			this.matches = url.match(p);
			if(this.matches == null || this.matches.length==0)
				return false;
			else
				return true;
		}
	}
}
