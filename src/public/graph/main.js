// todo move this over to ss
let nodes = [
    { id: "root", title: "." },
    { id: "programming", title: "programming" },
    { id: "contentCreation", title: "content creation" },
    { id: "luau", title: "luau" },
    { id: "webdev", title: "web development" },
    { id: "roblox", title: "roblox game dev" },
    { id: "youtube", title: "youtube" },
    { id: "videoEditingSoftwares", title: "video editing softwares" },
    { id: "premierPro", title: "premiere pro" },
    { id: "capCut", title: "capcut" },
    { id: "cicd", title: "CI/CD" },
    { id: "github", title: "github" },
    { id: "cloudflare", title: "cloudflare CDN/Hosting" },
    { id: "portfolio", title: "portfolio website" }
];

let links = [
    { source: "root", target: "programming" },
    { source: "root", target: "contentCreation" },
    { source: "programming", target: "luau" },
    { source: "programming", target: "webdev" },
    { source: "contentCreation", target: "roblox" },
    { source: "roblox", target: "luau" },
    { source: "roblox", target: "youtube" },
    { source: "youtube", target: "videoEditingSoftwares" },
    { source: "videoEditingSoftwares", target: "premierPro" },
    { source: "videoEditingSoftwares", target: "capCut" },
    { source: "webdev", target: "github" },
    { source: "webdev", target: "portfolio" },
    { source: "github", target: "cicd" },
    { source: "cloudflare", target: "cicd" },
    { source: "portfolio", target: "cloudflare" }
];

const svg = d3.select("svg");
const width = innerWidth, height = innerHeight;
const contextMenu = d3.select("#contextMenu");
let linkLine = null;
let linkMode = null;

// add a container for all nodes and links
const container = svg.append("g");

// zoom & pan behavior
const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => {
        container.attr("transform", event.transform);
    });

svg.call(zoom);

// Keep the simulation reference so nodes get positions live.
let simulation = d3.forceSimulation();

// --- Helpers ---
function getIdOf(end) {
    return (typeof end === "object") ? end.id : end;
}
function getNumber(v, fallback = 0) {
    return (typeof v === "number" && Number.isFinite(v)) ? v : fallback;
}
function normalizeLinksArray(arr) {
    return arr.map(l => ({ source: getIdOf(l.source), target: getIdOf(l.target) }));
}

// ----- renderGraph (combined, robust) -----
function renderGraph() {
    container.selectAll("*").remove(); // render inside container

    container.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 36)
        .attr("refY", 0)
        .attr("markerWidth", 12)
        .attr("markerHeight", 12)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#fff");

    // Normalize links to id-strings before feeding to forceLink
    const normalizedLinks = normalizeLinksArray(links);

    const link = container.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-opacity", 0.8)
        .selectAll("line")
        .data(normalizedLinks)
        .join("line")
        .attr("stroke-width", 0.5)
        .attr("marker-end", "url(#arrow)");

    // nodes
    const node = container.append("g")
        .selectAll("g")
        .data(nodes, d => d.id)
        .join("g")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            })
        )
        .on("contextmenu", (event, d) => {
            event.preventDefault();
            showContextMenu(event.pageX, event.pageY, d);
        })
        .on("click", (event, d) => {
            // click used for linking when linkMode active
            if (!linkMode) return;
            const from = linkMode.fromNode;
            const to = d;
            if (from.id === to.id) return;

            // normalize existing links to id strings first
            links = normalizeLinksArray(links);
            links.push({ source: from.id, target: to.id });
            linkMode = null;

            if (linkLine) { linkLine.remove(); linkLine = null; }
            renderGraph();
        });

    node.append("circle")
        .attr("r", 12)
        .attr("fill", "#00d1ff")
        .attr("stroke", "#ffffff20")
        .attr("stroke-width", 1.2);

    node.append("text")
        .text(d => d.title)
        .attr("x", 0)
        .attr("y", -18)
        .attr("text-anchor", "middle");

    // create or update the simulation
    // configure forces once
    if (!simulation.force("link")) {
        simulation
            .force("link", d3.forceLink().id(d => d.id).distance(60))
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(60));
    }

    // assign nodes and links
    simulation.nodes(nodes);
    simulation.force("link").links(normalizedLinks);

    simulation.on("tick", () => {
        link
            .attr("x1", d => getNumber(d.source.x))
            .attr("y1", d => getNumber(d.source.y))
            .attr("x2", d => getNumber(d.target.x))
            .attr("y2", d => getNumber(d.target.y));
        node.attr("transform", d => `translate(${getNumber(d.x)},${getNumber(d.y)})`);
    });

    simulation.alpha(0.3).restart();
}

renderGraph();

// ----- NEW: send button logic -----
const sendBtn = document.getElementById("sendBtn");
const statusEl = document.getElementById("status");

function showStatus(text, timeout = 3000) {
    statusEl.textContent = text;
    statusEl.style.display = "block";
    if (timeout) {
        setTimeout(() => statusEl.style.display = "none", timeout);
    }
}

async function sendSkillTree() {
    try {
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";

        const normalizedLinks = normalizeLinksArray(links);

        const serializedNodes = nodes.map(n => ({
            id: n.id,
            title: n.title
        }));

        const payload = {
            nodes: serializedNodes,
            links: normalizedLinks,
        };

        console.log("payload:", payload)

        const resp = await fetch("/api/sendSkillTree", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const text = await resp.text();
            console.error("Send failed:", resp.status, text);
            showStatus("Send failed: " + resp.status, 5000);
        } else {
            let data;
            try { data = await resp.json(); } catch (e) { data = null; }
            console.log("Send successful", data);
            showStatus("Skill tree sent ✓", 2500);
        }
    } catch (err) {
        console.error("Error sending skill tree:", err);
        showStatus("Error sending skill tree", 5000);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Skill Tree";
    }
}

sendBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sendSkillTree();
});

function showContextMenu(x, y, node) {
    contextMenu.style("left", x + "px")
        .style("top", y + "px")
        .style("display", "block")
        .html("");

    // Find nodes connected to this node (robust to string/object mix)
    const connectedNodes = links
        .filter(l => getIdOf(l.source) === node.id || getIdOf(l.target) === node.id)
        .map(l => {
            const otherId = getIdOf(l.source) === node.id ? getIdOf(l.target) : getIdOf(l.source);
            return nodes.find(n => n.id === otherId);
        })
        .filter(Boolean);

    const actions = [
        ...connectedNodes.map(cn => ({
            name: "Unlink from " + cn.title,
            action: () => unlinkNode(node, cn)
        })),
        { name: "Link To", action: () => startLinkMode(node) },
        { name: "Delete", action: () => deleteNode(node) },
        { name: "Create Node", action: () => createNodeAt(node) },
        { name: "Edit Title", action: () => editNodeTitle(node) }
    ];

    actions.forEach(a => {
        contextMenu.append("div")
            .text(a.name)
            .on("click", () => {
                a.action();
                contextMenu.style("display", "none");
            });
    });
}

function unlinkNode(node, targetNode) {
    const a = node.id, b = targetNode.id;
    links = links.filter(l => {
        const s = getIdOf(l.source), t = getIdOf(l.target);
        return !( (s === a && t === b) || (s === b && t === a) );
    });
    renderGraph();
}

function startLinkMode(node) {
    linkMode = { fromNode: node };

    // make sure fallback coords exist
    const sx = getNumber(node.x, width / 2);
    const sy = getNumber(node.y, height / 2);

    // Append line to the same container that is zoomed/panned
    linkLine = container.append("line")
        .attr("stroke", "#f0f")
        .attr("stroke-width", 2)
        .attr("pointer-events", "none")
        .attr("x1", sx)
        .attr("y1", sy)
        .attr("x2", sx)
        .attr("y2", sy);

    function onMouseMove(event) {
        if (!linkLine) return;

        // d3.pointer(event, container.node()) gives coords in container's local space
        const [cx, cy] = d3.pointer(event, container.node());

        linkLine
            .attr("x2", cx)
            .attr("y2", cy);
    }

    window.addEventListener("mousemove", onMouseMove);

    function stopLinkMode() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mousedown", stopLinkMode);
        if (linkLine) {
            linkLine.remove();
            linkLine = null;
        }
        linkMode = null;
    }

    window.addEventListener("mousedown", stopLinkMode);
}

function deleteNode(node) {
    const nid = node.id;
    links = links.filter(l => {
        const s = getIdOf(l.source), t = getIdOf(l.target);
        return s !== nid && t !== nid;
    });
    nodes = nodes.filter(n => n.id !== nid);
    renderGraph();
}

function createNodeAt(node) {
    const newId = "node" + Math.floor(Math.random() * 10000);

    // fallback coords if node.x/node.y not numeric
    const nx = Number.isFinite(node.x) ? node.x + 50 : width / 2 + 50;
    const ny = Number.isFinite(node.y) ? node.y + 50 : height / 2 + 50;

    const newNode = { id: newId, title: "New Node", x: nx, y: ny };
    nodes.push(newNode);
    links.push({ source: node.id, target: newId });
    renderGraph();
}

function editNodeTitle(node) {
    const newTitle = prompt("Edit node title:", node.title);
    if (newTitle !== null) node.title = newTitle;
    renderGraph();
}

// hide context menu on any click outside
window.addEventListener('click', () => contextMenu.style('display', 'none'));