// $ node neo4j_remove.js a a localhost 7474 1

var
  esc = require('querystring').escape,
  neo4j = require('./neo4j_driver.js');

var
	file_nodes = process.argv[2],
	file_relations = process.argv[3],
	host = process.argv[4],
	port = process.argv[5]
	debug = Number(process.argv[6]),
	neo4jClient = neo4j.createClient({'host':host, 'port':port}),
	uri_base = 'http://' + host + ':' + port + '/db/data/';

var start = process.hrtime();

var elapsed_time = function(note){
    var precision = 3; // 3 decimal places
    var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start = process.hrtime(); // reset the timer
}

deleteRelationships(0, 11694, function(){
	deleteNodes(1, 545, function(){});
});


function deleteNodes(base, num, callback){
	var cnt = 0;
	for(var i = base + 1; i <= base + num; i++){
		deleteNode(i, function(){
			cnt += 1;
			if(cnt % 100 == 0){
				if(debug) console.log('DELETING NODES STATUS:', cnt);
			}
			if(cnt == num){
				console.log('DELETING NODES FINISHED:', cnt);
				callback();
			}
		});
	}
}
function deleteNode(id, callback){
	// USE BATCH BECAUSE DELETE METHOD IS NOT DEFINED IN THE DRIVER
	data = [{'method':'DELETE', 'to':'node/' + id, 'body':'', 'id':0}];
	neo4jClient.post('batch/', data, function(obj){
		console.log(obj);
		callback();
	});
}
function deleteRelationships(base, num, callback){
	var cnt = 0;
	for(var i = base + 1; i <= base + num; i++){
		deleteRelationship(i, function(){
			cnt += 1;
			if(cnt % 100 == 0){
				if(debug) console.log('DELETING RELATIONSHIPS STATUS:', cnt);
			}
			if(cnt == num){
				console.log('DELETING RELATIONSHIPS FINISHED:', cnt);
				callback();
			}
		});
	}
}
function deleteRelationship(id, callback){
	// USE BATCH BECAUSE DELETE METHOD IS NOT DEFINED IN THE DRIVER
	data = [{'method':'DELETE', 'to':'relationship/' + id, 'body':'', 'id':0}];
	neo4jClient.post('batch/', data, function(obj){
		//console.log(obj);
		callback();
	});
}






