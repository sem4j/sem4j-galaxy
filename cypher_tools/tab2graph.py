# USAGE:
# python tab2graph.py test/tab2graph_input.dat 0 output_n.dat output_r.dat \
# '[{"column":"c1","name":"person","properties":[{"column":"c2","name":"sex"},{"column":"c3","name":"age"}]}, {"column":"c4","name":"dept","properties":[{"column":"c5","name":"tel"}]}]' \
# '[{"source":"c1","target":"c4","name":"belongs_to","properties":[{"column":"c7","name":"year"}]}]' 

import sys, time, json, sqlite_lib

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

conn = sqlite_lib.connect()
sqlite_lib.load(conn, 'input_table', input_file, input_header, '')
cur = conn.cursor()

# CREATE NODE TABLE
str_create_n = 'CREATE TABLE node_table (id, type);'
print(str_create_n)
time_start = time.time()
cur.execute(str_create_n)
print('Elapsed Time: ' + str(time.time() - time_start) + '\n')

# LOAD DATA (NODE_TABLE)
str_insert_n = "INSERT INTO node_table"
for n in nodes:
    str_insert_n += " SELECT DISTINCT " + n['column'] + ", '" + n['name'] + "' FROM input_table"
    if n != nodes[-1]:
        str_insert_n += " UNION"
    else:
        str_insert_n += ";"
print(str_insert_n)
time_start = time.time()
cur.execute(str_insert_n)
conn.commit()
print('Elapsed Time: ' + str(time.time() - time_start) + '\n')

# CREATE INDEX (NODE_TABLE)
str_index_n = 'CREATE INDEX idx_node ON node_table(id);'
print(str_index_n)
time_start = time.time()
cur.execute(str_index_n)
print('Elapsed Time: ' + str(time.time() - time_start) + '\n')

# SELECT (NODE)
sql = ""
for n in nodes:
    properties = n['properties']
    if len(properties) == 0:
        sql_properties = ", '{}'"
    else:
        sql_properties = ", '{'||"
        for p in properties:
            sql_properties += "'\"" + p['name'] + "\":\"'||i." + p['column'] + "||'\"'"
            if p != properties[-1]:
                sql_properties += "||','||"
            else:
                sql_properties += "||'}'"
    sql += "SELECT DISTINCT n.rowid, n.type, n.id" + sql_properties + "\n"
    sql += "FROM input_table i, node_table n\n"
    sql += "WHERE n.id = i." + n['column'] + " AND type = '" + n['name'] + "'\n"
    if n != nodes[-1]:
        sql += "  UNION ALL\n"
    else:
        sql += ";"
sqlite_lib.execute(conn, sql, output_file_n, '0', '0')

# SELECT (RELATION)
sql = ""
for r in relations:
    properties = r['properties']
    if len(properties) == 0:
        sql_properties = ", '{}'"
    else:
        sql_properties = ", '{'||"
        for p in properties:
            sql_properties += "'\"" + p['name'] + "\":\"'||i." + p['column'] + "||'\"'"
            if p != properties[-1]:
                sql_properties += "||','||"
            else:
                sql_properties += "||'}'"
    sql += "SELECT DISTINCT n1.rowid, n2.rowid, '" + r['name'] + "'" + sql_properties + "\n"
    sql += "FROM input_table i, node_table n1, node_table n2\n"
    sql += "WHERE n1.id = i." + r['source'] + " AND n2.id = i." + r['target'] + "\n"
    if r != relations[-1]:
        sql += " UNION ALL\n"
    else:
        sql += ";"
sqlite_lib.execute(conn, sql, output_file_r, '0', '0')

cur.close();
conn.close();
