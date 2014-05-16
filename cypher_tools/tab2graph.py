# USAGE:
# python tab2graph.py test/tab2graph_input.dat 0 output_n.dat output_r.dat \
# '[{"column":"c1","name":"person","properties":[{"column":"c2","name":"sex"},{"column":"c3","name":"age"}]}, {"column":"c4","name":"dept","properties":[{"column":"c5","name":"tel"}]}]' \
# '[{"source":"c1","target":"c4","name":"belongs_to","properties":[{"column":"c7","name":"year"}]}]' 

import sys, time, json, commands

argvs = sys.argv

input_file = argvs[1]
input_header = argvs[2]
output_file_n = argvs[3]
output_file_r = argvs[4]
nodes_json = argvs[5]
relations_json = argvs[6]

nodes = json.loads(nodes_json)
relations = json.loads(relations_json)

print(nodes_json)
print(nodes)
print(relations_json)
print(relations)

# SELECT (NODE)
for n in nodes:
    properties = n['properties']
    str_prop = ""
    if len(properties) != 0:
        str_prop = ","
        for p in properties:
            str_prop += p['type'] + ":\" APOST $" + p['column'] + " APOST \""
            if p != properties[-1]:
                str_prop += ","
            else:
                str_prop += ""
    str_awk = "awk -v APOST=\\' '{ print \"" 
    str_awk = str_awk + "CREATE (n:ALL:`" + n['type'] + "` "
    str_awk = str_awk + "{uri:\" APOST $" + n['column'] + " APOST \","
    str_awk = str_awk + "type:\" APOST \"" + n['type'] + "\" APOST \""
    str_awk = str_awk + str_prop + "});\"}' " + input_file
    cmd = str_awk + " | sort -t\\t -k1,1 | uniq >> " + output_file_n
    print cmd + "\n"
    commands.getoutput(cmd)

# SELECT (RELATION)
for r in relations:
    str_awk = ""
    properties = r['properties']
    str_prop = ""
    if len(properties) != 0:
        for p in properties:
            str_prop += p['type'] + ":\" APOST $" + p['column'] + " APOST \""
            if p != properties[-1]:
                str_prop += ","
            else:
                str_prop += ""
    str_awk = "awk -v APOST=\\' '{ print \""
    str_awk = str_awk + "MATCH (a:ALL {uri:\" APOST $" + r['source'] + " APOST \"})"
    str_awk = str_awk + ", (b:ALL {uri:\" APOST $" + r['target'] + " APOST \"}) "
    str_awk = str_awk + "CREATE (a)-[r:`" + r['type'] + "` {" + str_prop + "}]->(b);\"}' " + input_file
    cmd = str_awk + " | sort -t\\t -k1,1 | uniq >> " + output_file_r
    print cmd + "\n"
    commands.getoutput(cmd)
