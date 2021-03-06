// call on text selected
var text_area = document.getElementById("text_area");
var text_view = document.getElementById("text-view");
var viewBoxSlider = document.getElementById("sliderViewBox");
var radiusSlider = document.getElementById("sliderRadius");
var show_quiz_leaves_label = document.getElementById("quiz-leaves-label");
var show_quiz_leaves = document.getElementById("quiz-leaves");
var t = '';
var curr_selected_text = '';
var auto_repeat = false
var repeat_action = null
arr_cummulated_text = []
$("#pdf-viewer").hide()

document.getElementById('openPDF').onclick = function(event) {
    $("#pdf-viewer").toggle()
    $("#text-view").toggle()
        // var fileReader = new FileReader();
        // fileReader.onload = function() {

    //     var typedarray = new Uint8Array(this.result);
    //     //replaced the old function with the new api
    //     const loadingTask = PDFViewerApplication.open(typedarray);
    // }
    // var pdfFile = event.target.files[0];
    // fileReader.readAsArrayBuffer(pdfFile);
}

function set_reference() {
    if ($("#pdf-viewer").is(":visible")) {
        ref_id = graph_data.addRef(PDFViewerApplication.pdfDocumentProperties.url)
        graph_data.data["ref_id"] = ref_id
        graph_data.data["ref_page"] = PDFViewerApplication.pdfDocumentProperties._currentPageNumber
    } else {
        graph_data.data["ref_id"] = null
        graph_data.data["ref_page"] = null
    }
}

function updateClipboard(newClip) {

    if (typeof(navigator.clipboard) == 'undefined') {
        var textArea = document.createElement("textarea");
        textArea.value = newClip;
        textArea.style.position = "fixed"; //avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            var successful = document.execCommand('copy');
            var msg = successful ? 'successful' : 'unsuccessful';
            toastr.info(msg);
        } catch (err) {
            toastr.warning('Was not possible to copy te text: ', err);
        }

        document.body.removeChild(textArea)
        return;
    }
    navigator.clipboard.writeText(newClip).then(function() {
        /* clipboard successfully set */
    }, function() {
        /* clipboard write failed */
        console.log("Error: Copy to clipboard not allowed")
    });
}


action_funcs = {
    "child": (d) => {
        set_reference();
        graph_data.addChild(d);
        graph_data.data["note_id"] = null
    },
    "before": (d) => {
        set_reference();
        graph_data.addUncle(d);
        graph_data.data["note_id"] = null
    },
    "below": (d) => {
        set_reference();
        graph_data.addSibling(d);
        graph_data.data["note_id"] = null
    },
    "add-text": (d) => { arr_cummulated_text.push(d); return true; },
    "note": (d) => {
        const note_id = graph_data.addNote(d)
        graph_data.data["note_id"] = note_id
        return true;
    },
    "delete-node": () => {
        graph_data.deleteCurrentNode()
        refresh_view()
    },
    "copy-node": () => {
        outline_txt = graph_data.copyCurrentNode()
        updateClipboard(outline_txt)
    },
    "paste-node": () => {
        graph_data.pasteIntoCurrentNode();
        refresh_view();
    },
    "cut-node": () => {
        outline_txt = graph_data.copyCurrentNode();
        graph_data.deleteCurrentNode();
        updateClipboard(outline_txt)
        refresh_view()
    },
    "add-note": (d) => {
        set_reference();
        note_id = graph_data.addNote(d)
        graph_data.current_node.note_id = note_id
        graph_data.current_node.ref_id = graph_data.data["ref_id"]
        graph_data.current_node.ref_page = graph_data.data["ref_page"]
    },
    "edit-node": () => {
        const node_name = prompt("enter new name for this node", graph_data.current_node.name)
        if (node_name) {
            graph_data.current_node.name = node_name
            refresh_view()
        }
    },
    "add-to-anki": () => {
        frontjson = graph_data.stratify(graph_data.current_node)
        notes = graph_data.getNotes()
        settings = `radial_tree.zoom = ${radial_tree.zoom};
        radial_tree.radius = 25
        chart_tree.zoom = ${chart_tree.zoom}
        chart_tree.radius = 10;`
        json = {
            "action": "addNote",
            "version": 6,
            "params": {
                "note": {
                    "deckName": "Default",
                    "modelName": "Textograph",
                    "fields": {
                        "TestGraph": JSON.stringify(frontjson),
                        "AnswerGraph": "show_quiz_leaves.checked=false;refresh_view();",
                        // TODO: add references to notes
                        "Notes": JSON.stringify(notes),
                        "Settings": settings
                    },
                    "options": {
                        "allowDuplicate": true,
                        "duplicateScope": "deck"
                    },
                    "tags": [
                        // TODO: add references to the tag of anki
                        "textograph",
                        graph_data.root_node.name,
                        graph_data.name,
                        graph_data.current_node.name
                    ],
                }
            }
        }

        $.post({
            url: 'http://localhost:8765',
            data: JSON.stringify(json),
            error: function(xhr, status, error) {
                var err = xhr.responseText;
                server_obj.busy = false
                alert(err.Message);
            },
            success: function(data) {
                // ********* better to write with try catch  ****
                alert("anki note created successfully")
            }
        })
    }
}

$(document).keyup(function(e) {
    if (e.keyCode === 27) {
        auto_repeat = false;
        set_clss("auto-repeat", "")
        set_clss(repeat_action, "") //turn off prev
        repeat_action = null
        return;
    } else if (e.keyCode === 46) {
        graph_data.deleteCurrentNode()
        refresh_view()
    }
});

function ChangeDocText() {
    $("#text-view").html($("#text_area").htmlarea('html'));
    var event = new Event('click');
    document.getElementById("close-edit-dlg").dispatchEvent(event);
    $("#pdf-viewer").hide()
    $("#text-view").show()
}

function gText(e) {
    var selection = document.getSelection ?
        document.getSelection().toString() :
        document.selection.createRange().toString();
    t = selection
    if (selection && !show_quiz_leaves.checked) {
        if (repeat_action) {
            if (!action_funcs[repeat_action](t))
                redraw_graph();
            deselectAllTexts()
            curr_selected_text = ""
            t = ""
            if (repeat_action == "child") {
                // dont allow auto child creation, change it to add sibling instead                
                set_clss(repeat_action, "") //turn off prev
                repeat_action = "below"
                set_clss(repeat_action, "green-color") //turn on current                
            }
        }
        showMiniToolbar(e);
    } else {
        hide_minitoolbar();
    }
}

function showMiniToolbar(e) {
    box = document.querySelector('#mini-toolbar');
    toolbar = $("#mini-toolbar");
    Y = e.clientY + 10;
    toolbar.css("top", `${Y}px`);
    toolbar.css("display", 'flex');
    a = toolbar.width();
    X = e.clientX - (box.clientWidth / 2);
    toolbar.css("left", `${X}px`);
    regex_selected_text = new RegExp(t, 'i')
    cur_note = graph_data.getNote(graph_data.data["note_id"])
        // blink comment if there is indication
    if (!cur_note || cur_note.search(regex_selected_text) < 0)
        set_clss("note", "blink")
    else
        set_clss("note", "")

    set_clss("auto-repeat", auto_repeat ? "blink" : "")
}


function set_clss(item_id, class_name) {
    $(`#${item_id}`).attr("class", class_name)
}

function onSaveAsDialog() {

}

function onOpenDialog() {

}
document.onmouseup = gText;
if (!document.all) document.captureEvents(Event.MOUSEUP);


// call if textarea has been change
// text_area.onchange = function() {
//     $("#text-view").text(this.value)
// }
// document.addEventListener("mousedown", function() {
// })

function showCanvasToolbar(node) {
    // this function and next one are public and are called from chart and collapsible_tree objects.
    // in the future i must create a Draw class and create tree and collapsible_tree objects from Draw class
    // and initialize each object with a context menu function, in this way the encapsulation rule is not violated
    e = d3.event;
    const toolbar = $("#canvas-toolbar");
    toolbar.show();
    const Y = e.clientY - (toolbar.height() / 2);
    const X = e.clientX - toolbar.width() - 10;
    toolbar.css("left", `${X}px`);
    toolbar.css("top", `${Y}px`);
}

function hideCanvasToolbar(node) {
    toolbar = $("#canvas-toolbar");
    toolbar.hide();
}

// if toolbar buttons clicked
$("#canvas-toolbar").on('click', 'div', function() {
    the_id = $(this).attr("id")
    action_funcs[the_id]()
})

$("#mini-toolbar").on('click', 'div', function() {
    if (curr_selected_text || auto_repeat) {
        // do action if there is a selection or we are in recording mode
        the_id = $(this).attr("id")
        if (the_id == "auto-repeat" || the_id == repeat_action) { // code block to turn blinking on or off
            auto_repeat = auto_repeat ? false : true;
            set_clss("auto-repeat", auto_repeat ? "blink" : "")
            set_clss(repeat_action, "") //turn off prev
            repeat_action = null
            if (!auto_repeat) hide_minitoolbar(); //we just hase been turned it off
            return;
        }
        hide_minitoolbar()
        if (arr_cummulated_text.length > 0 && the_id != "add-text") {
            // aggregate previously selected texts if we are not in recording mode
            arr_cummulated_text.push(curr_selected_text)
            curr_selected_text = arr_cummulated_text.join(" ")
            delete arr_cummulated_text;
            arr_cummulated_text = []
        }
        if (curr_selected_text !== "")
            if (!action_funcs[the_id](curr_selected_text)) {
                redraw_graph()
                if (the_id == "child") the_id = "below" // dont allow auto child creation; instead, change it to add sibling 
                curr_selected_text = ""
                    // save_to_document()
                    // $("#save_area").text(`json_data=${json_str}; graph_data.setData(json_data);`)
            }
        if (auto_repeat)
            if (repeat_action != "add-text") {
                set_clss(repeat_action, "") //turn off prev                             
                set_clss(the_id, "green-color") //turn on current
                repeat_action = the_id;

            }
            // alert("You clicked on li " + $(this).text());
    }

});

function hide_minitoolbar() {
    deselectAllTexts();
    $("#mini-toolbar").hide();
}

$("#mini-toolbar").on('mousedown', 'div', function() {
    if (t) {
        curr_selected_text = t;
    }

});


$("#toolbar").on('click', 'div', function() {

    the_id = $(this).attr("id")
    switch (the_id) {
        case "web":
            drawer = radial_tree;
            break;
        case "tree":
            drawer = chart_tree;
            break;
        default:
            break;
    }
    // there should be some code to set the zoming and radius slider based on level of corresponding drawer value
    refresh_view();
    // alert("You clicked on li " + $("#save_area").val());
    // var json = JSON.stringify([...graph_data.nodes.values()]);
    // $("#save_area").text("data = " + json + ";graph_data.setData(data)")

});

function deselectAllTexts() {
    try {
        document.selection.empty();
    } catch (error) {}
    window.getSelection().removeAllRanges();
}

function refresh_view() {
    redraw_graph();
    getQuiz();
}

function redraw_graph(draw = true) {
    // puts new data into chart and draws the chart from scratch

    if (graph_data.nodes.size) {
        viewBoxSlider.value = drawer.zoom
        radiusSlider.value = drawer.radius
        json = graph_data.stratify();
        let data = d3.hierarchy(json);
        drawer.selected_node_id = graph_data.current_node.id
        if (draw) drawer.draw(data);
        return data;
    }
}


//var output = document.getElementById("demo");
//output.innerHTML = slider.value;
show_quiz_leaves_label.onchange = getQuiz

function getQuiz() {
    let active_node = graph_data.getActiveNode()
    if (show_quiz_leaves.checked) {
        if (active_node == null) {
            alert("please select a node first")
            show_quiz_leaves.checked = false
            return
        }
        $("#pdf-viewer").hide()
        new_data = graph_data.stratify(active_node); // make new hierarchy from active node
        // copy current graph_data to save its data from being changed
        graph_data = Object.assign({}, graph_data, { nodes: new Map() })
        graph_data.setData(new_data) // and make it default data for layout


        var question_hierarchy = redraw_graph(false) // just get hierarchy does not display anything
        var answers = question_hierarchy.leaves();
        // make html divs from leaves

        //          when div clicked: if div data parent id matches with hierarchy id remove div and add it to hierarchy
        // delete leaves from hierarchy
        remove_leaves(question_hierarchy);
        drawer.draw(question_hierarchy);

        // create a pan and insert answers into it
        d3.select("#quiz_choices").remove()
        const quiz = d3.select("#text-column")
            .append("div")
            .attr("id", "quiz_choices")
            .selectAll("div")
            .data(answers)
            .join("div")
            .attr("id", d => `answer_${d.data.id}`)
            .attr("class", "answer")
            .text(d => d.data.name)
            .on("click", function(d, i) {
                if (d.parent.data.id == graph_data.getActiveNode().id) {
                    parent_childs = d.parent.children
                    if (parent_childs == null) {
                        if (d.parent._children == null) {
                            d.parent.children = new Array
                            parent_childs = d.parent.children
                        } else {
                            parent_childs = d.parent._children
                        }
                    }
                    parent_childs.push(d)
                    d.parent._children = parent_childs
                    d3.select(this).node().remove()
                    drawer.refresh();
                } else {

                }

            });
    } else {
        delete graph_data
        graph_data = graph_data_copy
        redraw_graph()
        d3.select("#quiz_choices").remove()
    }
}
radiusSlider.oninput = function() {
    drawer.radius = this.value;
    drawer.refresh();
}

viewBoxSlider.oninput = function() {
    drawer.changeZoom(this.value);
}

function remove_leaves(hierarchy) {
    hierarchy.descendants().forEach((d, i) => {
        d.id = i;
        if (d.height == 1) {
            // this node only have leaves so we can remove all children at once
            delete d.children;
            // d.children = null;
        } else if (d.height != 0) {
            // just remove children that are leaves
            let new_children = new Array;
            d.children.forEach(node => {
                if (node.height != 0)
                    new_children.push(node);
            });
            d.children = new_children;
        }
    });
}

function hash_str(str) {
    var hash = 0;
    if (str.length == 0) return hash;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}