
// REQUIRE
var esc = require('querystring').escape,
	neo4j = require('./neo4j_driver.js'),
	fs = require('fs'),
	readline = require('readline'),
	mysql = require('mysql');

// ARGUMENTS
var file_nodes = process.argv[2],
	file_relations = process.argv[3],
    namespace = process.argv[4],
	host = process.argv[5],
	port = process.argv[6],
	debug = Number(process.argv[7]);

// VARIABLES
var neo4jClient = neo4j.createClient({'host':host, 'port':port}),
	uri_base = 'http://' + host + ':' + port + '/db/data/',
	start = process.hrtime();

// MAIN
getBaseId(function(nid_base, rid_base){
	console.log('BASE NODE ID:', nid_base);
	console.log('BASE RELATIONSHIP ID:', rid_base);
	// ADD EMPTY NODES FIRST, THEN ADD PROPERTIES TO THE NODES WITH APPROPRIATE ID.
	// OTHERWISE, CANNOT GET CORRECT ID BECAUSE ADD NODE REQUESTS FINISHES IN NO ORDER.
	addNodes(file_nodes, nid_base, function(nnum){
		if(debug) elapsed_time('elapsed');
		addNodeProperties(file_nodes, nid_base, function(nnum2){
			if(debug) elapsed_time('elapsed');
			addRelations(file_relations, nid_base, function(rnum){
				if(debug) elapsed_time("elapsed");
				saveMetadata(file_nodes, file_relations, nid_base, rid_base, nnum, rnum);
				
			});
		});
	});
});

// MYSQL CONNECTION
function connect(callback){
	var conn = mysql.createConnection({
		'host': host,
		'database':'sem4j',
		'user':'sem4j',
		'password':'sem4j'
	});
	callback(conn);
}
function saveMetadata(file_nodes, file_relations, nid_base, rid_base, nnum, rnum){
	connect(function(conn){
		//console.log(conn);
		conn.query(
				"INSERT INTO load_info VALUES(null,?,?,?,?,?,?,?);",
				[getTime(), file_nodes, file_relations, nid_base, rid_base, nnum, rnum],
				function (err, results) {
			if (err) {
				console.log(err);
			}
			console.log('--- results ---');
			console.log(results);
			conn.end(function(){
				console.log('connection end');
			})
		});
	});
}
function getTime() {
    var str = "";

    var currentTime = new Date()
    var hours = currentTime.getHours()
    var minutes = currentTime.getMinutes()
    var seconds = currentTime.getSeconds()

    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (seconds < 10) {
        seconds = "0" + seconds
    }
    str += hours + ":" + minutes + ":" + seconds + " ";
    return str;
}

function elapsed_time(note){
//var elapsed_time = function(note){
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start = process.hrtime(); // reset the timer
}
function getBaseId(callback){
	// CREATE TEST NODE
	neo4jClient.post('node', '', function(obj){
		// NODE ID IS NOT REUSED, SO THIS IS THE BASE ID
		var nid_base = Number(obj.self.split('/')[6]);
		// CREATE TEST RELATIONSHIP
		var data = { 'to' : uri_base + 'node/' + nid_base, 'type':'test', 'data':{} };
		neo4jClient.post('node/' + nid_base + '/relationships/', data, function(obj) {
			var rid_base = Number(obj.self.split('/')[6]);
			// DELETE TEST RELATIONSHIP FIRST
			// USE BATCH BECAUSE DELETE METHOD IS NOT DEFINED IN THE DRIVER
			var data = [{'method':'DELETE', 'to':'relationship/' + rid_base, 'body':'', 'id':0}];
			neo4jClient.post('batch/', data, function(){
				// DELETE TEST NODE
				var data = [{'method':'DELETE', 'to':'node/' + nid_base, 'body':'', 'id':0}];
				neo4jClient.post('batch/', data, function(){
					callback(nid_base, rid_base);
				})
			});
		});
	});
}
function addNodes(file, nid_base, callback){
	var rs = fs.ReadStream(file);
	var rl = readline.createInterface({'input': rs, 'output': {}});
	var cnt_added = 0;
	var cnt_line = 0;
	var num_line = 0;
	rl.on('line', function(line){
		cnt_line += 1;
		line = line.split("\t");
		addNode(function(){
			cnt_added += 1;
			if(cnt_added % 100 == 0){
				if(debug) console.log('ADDING EMPTY NODES STATUS:', cnt_added);
			}
			if(cnt_added == num_line){
				console.log('ADDING EMPTY NODES FINISHED:', cnt_added);
				callback(num_line);
			}
		});
	}).on('pause', function(){
		num_line = cnt_line;
		console.log('ADDING EMPTY NODES START:', num_line);
	});
	rl.resume();
}
function addNode(callback){
	neo4jClient.post('node', '', function(obj){
		callback();
	});
};
function addNodeProperties(file, nid_base, callback){
	var rs = fs.ReadStream(file);
	var rl = readline.createInterface({'input': rs, 'output': {}});
	var cnt_added = 0;
	var cnt_line = 0;
	var num_line = 0;
	rl.on('line', function(line){
		cnt_line += 1;
		line = line.split("\t");
		addNodeProperty(Number(line[0]) + nid_base, line[1], line[2], line[3], namespace, file, function(){
			cnt_added += 1;
			if(cnt_added % 100 == 0){
				if(debug) console.log('ADDING NODE PROPERTIES STATUS:', cnt_added);
			}
			if(cnt_added == num_line){
				console.log('ADDING NODE PROPERTIES FINISHED:', cnt_added);
				callback(num_line);
			}
		});
	}).on('pause', function(){
		num_line = cnt_line;
		console.log('ADDING NODE PROPERTIES START:', num_line);
	});
	rl.resume();
}
function addNodeProperty(node_id, type, name, properties, namespace, filename, callback){

	var body = JSON.parse(properties);
	body['name'] = name;
	body['type'] = type;
	body['rowid'] = node_id;
	body['namespace'] = namespace;
	body['filename'] = filename;
	var uri_node = uri_base + 'node/' + node_id;
	
	// USE BATCH BECAUSE PUT METHOD IS NOT DEFINED IN THE DRIVER
	var data = [
	    {'method':'PUT', 'to':'node/' + node_id + '/properties', 'body':body, 'id':0},
	    {'method':'POST', 'to':'index/node/' + esc(namespace), 'body':{uri:uri_node, key:'name', value:name}, 'id':1}];
		//{'method':'POST', 'to':'index/node/' + esc(namespace), 'body':{uri:uri_node, key:'namespace', value:namespace}, 'id':2},
		//{'method':'POST', 'to':'index/node/' + esc(namespace), 'body':{uri:uri_node, key:'filename', value:esc(filename)}, 'id':3}];
	
	neo4jClient.post('batch/', data, function(obj){
		//console.log('DEBUG: Added:', obj, node_id, name);
		callback();
	});
	
	/*
	// USE BATCH BECAUSE PUT METHOD IS NOT DEFINED IN THE DRIVER
	data = [{'method':'PUT', 'to':'node/' + node_id + '/properties', 'body':body, 'id':0}];
	neo4jClient.post('batch/', data, function(){
		uri_node = uri_base + 'node/' + node_id;
		var data = [{'method':'POST', 'to':'index/node/' + esc(index), 'body':{uri:uri_node, key:'name', value:name}, 'id':0},
		            {'method':'POST', 'to':'index/node/' + esc(index), 'body':{uri:uri_node, key:'namespace', value:namespace}, 'id':1},
		            {'method':'POST', 'to':'index/node/' + esc(index), 'body':{uri:uri_node, key:'filename', value:esc(filename)}, 'id':2}];
		neo4jClient.post('batch/', data, function(obj){
			console.log('DEBUG: Added:', obj, node_id, name);
			callback();
		});
	});
	*/
};
function addRelations(file, nid_base, callback){
	var rs = fs.ReadStream(file);
	var rl = readline.createInterface({'input': rs, 'output': {}});
	var cnt_added = 0, cnt_line = 0, num_line = 0;
	rl.on('line', function(line){
		cnt_line += 1;
		line = line.split("\t");
		addRelation(Number(line[0]) + nid_base, Number(line[1]) + nid_base, line[2], line[3], 'sem4j.org', file, function(){
			cnt_added += 1;
			if(cnt_added % 100 == 0){
				if(debug) console.log('ADDING RELATIONS STATUS:', cnt_added);
			}
			if(cnt_added == num_line){
				console.log('ADDING RELATIONS FINISHED:', cnt_added);
				callback(cnt_added);
			}
		});
	}).on('pause', function(){
		num_line = cnt_line;
		console.log('ADDING RELATIONS START:', num_line);
	});
	rl.resume();
}
function addRelation(source, target, type, properties, namespace, filename, callback){
	var index = 'users';
	var body = JSON.parse(properties);
	var relation = { 'to' : uri_base + 'node/' + target, 'type': type, 'data' : body };
	neo4jClient.post('node/' + source + '/relationships/', relation, function() {
		callback();
	});
	/*
	var data = [
	    {'method':'POST', 'to':'node/' + source + '/relationships/', 'body':relation, 'id':0},
	    {'method':'POST', 'to':'index/relationship/' + esc(index), 'body':{'uri':'{0}', key:'namespace', value:namespace}, 'id':1},
	    {'method':'POST', 'to':'index/relationship/' + esc(index), 'body':{'uri':'{0}', key:'filename', value:esc(filename)}, 'id':2}];
	neo4jClient.post('batch/', data, function(obj){
		//console.log(obj);
		callback();
	});
	*/
};

/*

function getNodeIDBase(callback){
	var data = {
			"query":"start n = node(*) return max(ID(n))",
			"params":{}
		};
	neo4jClient.post('cypher', data, function(obj){
		if(obj.data[0][0]){
			var nid_base = obj.data[0][0];
		}else{
			var nid_base = 0;
		}
		callback(nid_base);
	});
}

function addNodeOld(node_id, type, name, properties, callback){

	index = 'idx_name';
	
	//name = 'Neo';
	//type = 'person';
	var input = JSON.parse(properties);
	//console.log(input);
	
	//input = {'name':name, 'type':type, 'node_id':node_id};
	input['name'] = name;
	input['type'] = type;
	input['node_id'] = node_id;
	console.log(input);
	
	neo4jClient.post('node', input, function(obj){
		var data = { uri:obj.self, key:'name', value:name };
		neo4jClient.post(['index/node', esc(index)], data, function(){
			console.log('Added:', obj.self, node_id, name);
			callback();
		});
	});
};

*/