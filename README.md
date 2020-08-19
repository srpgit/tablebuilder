# tablebuilder
Build html table from nested data structure.

 >- Zero dom operator
 >- No dependency
 >- Support ES5+
 >- Can run in any environment, including server side.
 
 # Demo
 ```
 var tb =  TableBuilder.build_table(opts); // create TableBuilder instance, as for TableBuilder.defaults refer to TableBuilder.defaults
 wrapper.innerHTML = tb.table.toString(); // tb.table.toString() returns table string
 ```
 # Data structure
 ```
 opts.header_nodes = [{
   children: {} // children contains next level nodes
 }]
 
// callback to transfer node info 
opts.extract_node_info = function(node) {
 return {
   key: node.id, // optional, if provided header cells will have an unique key
   text: node.name, // required, content of the cell
 }
}

```
