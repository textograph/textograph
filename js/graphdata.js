class GraphNode {
    constructor(id, name, parent = null) {
        this.id = id;
        this.name = name;
        this.parent = parent;
    }
}

function getNodeNote(d) {

    if (d != null) {
        node = d.data
        if (node.note_id != null)
            return graph_data.notes[node.note_id]
        else
            return getNodeNote(d.parent)
    } else
        return null
}

function getNodeRef(d) {
    if (d != null) {
        const node = d.data
        if (node.ref_id != null)
            return graph_data.references[node.ref_id];
        else
            return ""
    }
}

var graph_data = {
    nodes: new Map(),
    notes: {},
    references: {},
    data: {}, // adjunctive data like note id, reference id and so on, used by add_to_child function
    current_node: null,
    root_node: null,
    current_depth: 0,
    auto_inc_id: 0,
    note_auto_id: 0,
    version: 0.1,
    name: "untitled",
    id: null,
    url: null,
    clipboard: null,

    deleteCurrentNode() {
        nodes = [...this.nodes.values()]
        this.deleteNode(this.current_node, nodes)
    },
    copyCurrentNode() {
        this.clipboard = this.stratify(this.current_node, false)
        return this.getOutline(this.current_node, false)
    },
    pasteIntoCurrentNode() {
        _nodes = new Map()
        try {
            // makes hierarchial jason graph to tabular form
            tmp_arr = destratify(this.clipboard, this.current_node, this.auto_inc_id)
            this.auto_inc_id += tmp_arr.length
                // saves tabular data in a temporary Map object (Dictionary)
            tmp_arr.forEach(node => {
                _nodes.set(node.id, node)
            });

        } catch (error) {
            console.log("there is an error in pasting")
            return false;
        }
        this.nodes = new Map([...this.nodes, ..._nodes])
    },
    deleteNode(parent, nodes) {
        nodes.forEach((node, index) => {
            if (node.parent == parent) {
                delete nodes[index]
                this.deleteNode(node, nodes)
            }
        });
        this.nodes.delete(parent.id)
    },

    addChildTo(node, parent = null) {
        // adds new node to nodes repo, increases autonumber, 
        //  and makes currnt_node pointer to point to the newly created node

        if (typeof node === "string") {

            if (this.nodes.size == 0 || // there is no other node (creating root node)
                this.nodes.has(parent.id) // or check if parent is present
            ) {
                new_node = new GraphNode(this.auto_inc_id, node, parent)
                new_node = Object.assign(new_node, this.data) // add additional data to new node
                this.nodes.set(this.auto_inc_id++, new_node) // add new node to our node repo
                this.current_node = new_node;
                return new_node;
            } else {
                throw "Error: parent id not found";
            }

        } else {
            throw "Error: add child from object Not implemented yet node must be a string";

        }

    },

    addChild(node) { // adds a child to the current node

        if (this.current_node !== null) {
            this.addChildTo(node, this.current_node);
            this.current_depth++;
        } else if (this.nodes.size == 0) {
            this.root_node = this.addChildTo(node, null)
            this.current_depth = 0;
        } else {
            // there is no node in our repo so create first one
            throw "Error: there is no active node, however nodes' repo is not empty"
        }
    },

    addSibling(node) { // adds a child to the parent of current node
        if (this.current_node !== null) {
            if (this.current_node.parent !== null) {
                this.addChildTo(node, this.current_node.parent);
            }
        } else {
            this.addChild(node);
        }

    },
    addUncle(node) { // adds a child to the grandparent of current node
        if (this.current_node !== null) {
            if (this.current_node.parent !== null) {
                if (this.current_node.parent.parent !== null) {
                    this.addChildTo(node, this.current_node.parent.parent);
                }
            }
        } else {
            this.addChild(node);
        }

    },
    addNote(txt_note) {
        this.notes[this.note_auto_id] = txt_note
        return this.note_auto_id++
    },
    getNote(id) {
        return this.notes[id]
    },
    getNotes() {
        return this.notes
    },
    setNotes(notes) {
        this.notes = notes
        max = 0
        for (let key in this.notes)
            if (max < +key) max = +key
        this.note_auto_id = max + 1
    },
    addRef(ref_name) {
        const ref_id = hash_str(ref_name);
        this.references[ref_id] = ref_name;
        return ref_id;
    },
    getRef(ref_id) {
        return this.references[ref_id]
    },
    getReferences() {
        return this.references
    },
    setReferences(references) {
        this.references = references
    },
    stratify(parent = null, copy_id = true) {
        nodes = [...this.nodes.values()]
        if (parent == null) {
            root_id = Math.min(...this.nodes.keys())
            parent = this.nodes.get(root_id)
        }
        return stratify(parent, nodes, copy_id) //parent is null so it returns all hierarchy including root
    },
    getOutline(parent = null) {
        nodes = [...this.nodes.values()]
        if (parent == null) {
            root_id = Math.min(...this.nodes.keys())
            parent = this.nodes.get(root_id)
        }
        return make_outline(parent, nodes, 0)
    },

    setData(json_graph) {
        let _nodes = new Map()
        try {
            // makes hierarchial jason graph to tabular form
            tmp_arr = destratify(json_graph, null)

            // saves tabular data in a temporary Map object (Dictionary)
            tmp_arr.forEach(node => {
                _nodes.set(node.id, node)
            });
        } catch (error) {
            return false;
        }

        this.eraseData();
        delete this.current_node
            // Store temporary generated Map        
        this.nodes = _nodes;
        // set root node
        root_id = Math.min(...this.nodes.keys())
        this.root_node = this.nodes.get(root_id)
        this.changeCurrentNode(root_id)
        this.auto_inc_id = Math.max(...this.nodes.keys()) + 1
        return true;
    },
    getJsonStr() {
        return JSON.stringify(this.stratify());
    },
    eraseData() {
        this.nodes.clear();
    },
    changeCurrentNode(id) {
        this.current_node = this.nodes.get(id);
    },
    getActiveNode() {
        return this.current_node;
    },
    isCompatible(version) {
        return (version == this.version) ? true : false;
    }

}


function stratify(parent, nodes, copy_id = true) {
    // all the data will be copied except parent
    const new_node = Object.assign({}, parent, {
        children: []
    })
    delete new_node.parent

    if (copy_id) new_node.id = parent.id
    nodes.forEach((node, index) => {
        if (node.parent == parent) {
            delete nodes[index]
            new_node.children.push(stratify(node, nodes, copy_id))
        }
    });
    return new_node
}

function make_outline(parent, nodes, number_of_tabs) {
    outline_str = ""
    nodes.forEach((node, index) => {
        if (node.parent == parent) {
            delete nodes[index]
            outline_str = outline_str + "\t".repeat(number_of_tabs) + node.name + "\n" + make_outline(node, nodes, number_of_tabs + 1)
        }
    })
    return outline_str
}


function destratify(node, parent = null, base_id = null) {
    let child_arr = []
        // all the data will be copied except children array
    let cur_obj = Object.assign({}, node, {
        id: base_id ? base_id++ : node.id,
        parent,
        children: null
    })
    delete cur_obj.children
    node.children.forEach(child => {
        this_node_childs = destratify(child, cur_obj, base_id)
        if (base_id != null) {
            base_id += this_node_childs.length
        }

        child_arr = child_arr.concat(this_node_childs)

    });
    child_arr.push(cur_obj)
    return child_arr;
}
var graph_data_copy = graph_data