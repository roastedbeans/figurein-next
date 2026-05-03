// Tagged icon catalog with accurate descriptions of what each icon actually depicts.
// The AI uses these tags to pick the correct icon for each concept.
// IMPORTANT: "cell" is a biological/medical cell, NOT a cell tower. Use "telecom" for cell towers.

export const ICON_CATALOG = [
  // === TELECOM & WIRELESS ===
  { id: "ibm-pictograms-telecom", tags: "cell tower, base station, antenna tower, radio tower, transmission tower, signal broadcast, cellular tower, BTS, eNodeB, gNodeB" },
  { id: "ibm-pictograms-telecommunications", tags: "network signal waves, connectivity arcs, wireless coverage, signal propagation, radio waves" },
  { id: "ibm-pictograms-satellite", tags: "satellite, orbital, space communication, GPS satellite, GNSS" },
  { id: "ibm-pictograms-satellite-dish", tags: "satellite dish, parabolic antenna, ground station, radio telescope, dish receiver" },
  { id: "ibm-pictograms-wireless-modem", tags: "wireless router, WiFi router, modem, access point, wireless gateway, WiFi" },
  { id: "ibm-pictograms-console-wireless", tags: "wireless console, remote wireless control, wireless terminal" },
  { id: "ibm-pictograms-wireless-home", tags: "smart home, wireless home, home network, IoT home" },
  { id: "ibm-pictograms-connectivity", tags: "connectivity, connection lines, link, interconnect" },

  // === DEVICES ===
  { id: "ibm-pictograms-mobile-phone", tags: "mobile phone, smartphone, handset, cellular phone, UE, user equipment, mobile device" },
  { id: "ibm-pictograms-mobile-devices", tags: "multiple mobile devices, phones, tablets, mobile fleet" },
  { id: "ibm-pictograms-mobile", tags: "mobile, phone, portable device" },
  { id: "ibm-pictograms-tablet-device", tags: "tablet, iPad, touchscreen device" },
  { id: "ibm-pictograms-desktop", tags: "desktop computer, PC, workstation, computer monitor" },
  { id: "ibm-pictograms-monitor", tags: "monitor, display screen, terminal, dashboard screen" },
  { id: "ibm-pictograms-connected-devices", tags: "connected devices, IoT devices, multiple devices linked, device mesh" },
  { id: "ibm-pictograms-device-pairing", tags: "device pairing, bluetooth pairing, NFC tap, device sync" },
  { id: "ibm-pictograms-add-device", tags: "add device, register device, new device enrollment" },
  { id: "ibm-pictograms-network-of-devices", tags: "network of devices, device mesh, IoT network, device topology" },
  { id: "ibm-pictograms-rotate-device", tags: "rotate device, orientation change" },
  { id: "ibm-pictograms-keyboard", tags: "keyboard, input device, typing" },

  // === NETWORK & INFRASTRUCTURE ===
  { id: "ibm-pictograms-network", tags: "network topology, hexagonal mesh, interconnected nodes, graph, mesh network" },
  { id: "ibm-pictograms-network-02", tags: "network topology variant, distributed nodes, network graph" },
  { id: "ibm-pictograms-networking-01", tags: "networking, hub and spoke, star topology, network connections" },
  { id: "ibm-pictograms-networking-02", tags: "networking variant, distributed network, peer connections" },
  { id: "ibm-pictograms-networking-03", tags: "networking variant, layered network, hierarchical" },
  { id: "ibm-pictograms-networking-04", tags: "networking variant, ring topology" },
  { id: "ibm-pictograms-networking-05", tags: "networking variant, bus topology" },
  { id: "ibm-pictograms-networking-06", tags: "networking variant, full mesh" },
  { id: "ibm-pictograms-network-appliances", tags: "network appliances, switches, routers, network hardware, middlebox" },
  { id: "ibm-pictograms-network-services", tags: "network services, network functions, DNS, DHCP" },
  { id: "ibm-pictograms-network-traffic", tags: "network traffic, data flow, bandwidth, throughput, packets" },
  { id: "ibm-pictograms-content-delivery-network", tags: "CDN, content delivery, edge network, distribution" },
  { id: "ibm-pictograms-hard-drive-network", tags: "NAS, network storage, storage network, shared drive" },
  { id: "ibm-pictograms-storage-area-networks", tags: "SAN, storage area network, block storage, storage fabric" },
  { id: "ibm-pictograms-global-network", tags: "global network, worldwide network, internet, WAN, international" },
  { id: "ibm-pictograms-private-network-01", tags: "private network, VPN, intranet, isolated network, secure tunnel" },
  { id: "ibm-pictograms-private-network-02", tags: "private network variant, VPN tunnel, secure channel" },
  { id: "ibm-pictograms-movement-in-overlapping-networks", tags: "handover, roaming, network overlap, cell handoff, mobility" },

  // === SERVERS & COMPUTE ===
  { id: "ibm-pictograms-server-rack", tags: "server rack, data center rack, rack unit, hardware rack" },
  { id: "ibm-pictograms-servers", tags: "servers, multiple servers, server cluster, server farm" },
  { id: "ibm-pictograms-active-server", tags: "active server, running server, live server, production server" },
  { id: "ibm-pictograms-virtual-server", tags: "virtual server, VM, virtual machine, virtualization" },
  { id: "ibm-pictograms-compute", tags: "compute, processing, CPU, computation, processor" },
  { id: "ibm-pictograms-accelerated-computing", tags: "accelerated computing, hardware acceleration, FPGA, ASIC" },
  { id: "ibm-pictograms-gpu-computing", tags: "GPU computing, graphics processing, parallel computing, GPU" },
  { id: "ibm-pictograms-high-performance-computing", tags: "HPC, supercomputer, high performance, cluster computing" },
  { id: "ibm-pictograms-database", tags: "database, data store, DB, SQL, storage backend, data repository" },

  // === SECURITY ===
  { id: "ibm-pictograms-security-shield", tags: "security shield, protection, defense, guard, secure, shield icon" },
  { id: "ibm-pictograms-security", tags: "security, padlock with checkmark, verified security, security check" },
  { id: "ibm-pictograms-security-02", tags: "security variant, general security concept" },
  { id: "ibm-pictograms-firewall", tags: "firewall, network firewall, traffic filter, packet filter, WAF, security barrier" },
  { id: "ibm-pictograms-lock-01", tags: "padlock, locked, secure, closed lock, access denied" },
  { id: "ibm-pictograms-lock-02", tags: "padlock variant, locked state, secured" },
  { id: "ibm-pictograms-unlock-01", tags: "unlocked, open lock, unsecured, unlocked state, access granted" },
  { id: "ibm-pictograms-unlock-02", tags: "unlocked variant, open padlock" },
  { id: "ibm-pictograms-encryption", tags: "encryption, encrypted data, cipher, cryptography, encoded, AES, RSA" },
  { id: "ibm-pictograms-encryption-02", tags: "encryption variant, data encryption, secure encoding" },
  { id: "ibm-pictograms-locked-network-01", tags: "locked network, secured network, private network with lock" },
  { id: "ibm-pictograms-locked-network-02", tags: "locked network variant, encrypted network, VPN network" },
  { id: "ibm-pictograms-network-protection", tags: "network protection, network defense, network guard" },
  { id: "ibm-pictograms-network-security", tags: "network security, secure network, protected infrastructure" },
  { id: "ibm-pictograms-infrastructure-security", tags: "infrastructure security, system protection, core security" },
  { id: "ibm-pictograms-application-security", tags: "application security, app security, software security, secure app" },
  { id: "ibm-pictograms-data-security", tags: "data security, data protection, secure data, classified data" },
  { id: "ibm-pictograms-data-protection-data-security", tags: "data protection, GDPR, compliance, data shield" },
  { id: "ibm-pictograms-secure-gateway", tags: "secure gateway, security proxy, secure entry point, DMZ" },
  { id: "ibm-pictograms-secure-data", tags: "secure data, protected data, safe data storage" },
  { id: "ibm-pictograms-continuous-security", tags: "continuous security, ongoing monitoring, security lifecycle" },
  { id: "ibm-pictograms-security-intelligence", tags: "security intelligence, SIEM, threat intel, security analytics" },
  { id: "ibm-pictograms-security-management", tags: "security management, security operations center, SOC" },
  { id: "ibm-pictograms-quantum-safe", tags: "quantum safe, post-quantum cryptography, quantum resistant, PQC" },

  // === THREATS & ATTACKS ===
  { id: "ibm-pictograms-bug-virus-malware", tags: "malware, virus, bug, trojan, worm, ransomware, infected, malicious code" },
  { id: "ibm-pictograms-advanced-threats", tags: "advanced threat, APT, sophisticated attack, zero-day, exploit" },
  { id: "ibm-pictograms-threat-management", tags: "threat management, threat response, incident management, SOAR" },
  { id: "ibm-pictograms-master-threat-hunting", tags: "threat hunting, proactive defense, threat search, threat detection" },
  { id: "ibm-pictograms-detect-and-stop-advancing-threats", tags: "threat detection, IDS, IPS, intrusion detection, intrusion prevention" },
  { id: "ibm-pictograms-advanced-fraud-protection", tags: "fraud protection, anti-fraud, fraud detection, scam prevention" },
  { id: "ibm-pictograms-warning-01", tags: "warning, alert, caution, danger, exclamation triangle, alarm" },
  { id: "ibm-pictograms-warning-02", tags: "warning variant, critical alert, error, system warning" },

  // === IDENTITY & ACCESS ===
  { id: "ibm-pictograms-user", tags: "user, person, individual, human, account" },
  { id: "ibm-pictograms-user-profile", tags: "user profile, account profile, identity, persona" },
  { id: "ibm-pictograms-trusted-user", tags: "trusted user, verified user, authenticated person, legitimate user" },
  { id: "ibm-pictograms-unauthorized-user-access", tags: "unauthorized access, intruder, hacker, attacker, malicious user, impersonation" },
  { id: "ibm-pictograms-attacker-laptop", tags: "attacker with laptop, hooded hacker at computer, cybercriminal, threat actor with device, adversary, intruder with laptop, hacker workstation" },
  { id: "ibm-pictograms-anonymous-users", tags: "anonymous user, unknown identity, unidentified, masked user" },
  { id: "ibm-pictograms-high-risk-users", tags: "high risk user, suspicious user, compromised account, risky behavior" },
  { id: "ibm-pictograms-digital-id", tags: "digital identity, ID card, certificate, credential, digital certificate, X.509" },
  { id: "ibm-pictograms-access-management", tags: "access management, IAM, access control, permissions, RBAC" },
  { id: "ibm-pictograms-identify-and-access", tags: "identity and access, authentication, authorization, SSO, SAML" },
  { id: "ibm-pictograms-data-privacy-key", tags: "privacy key, encryption key, secret key, API key, key management, PKI" },
  { id: "ibm-pictograms-data-privacy", tags: "data privacy, personal data, PII, confidential data" },
  { id: "ibm-pictograms-data-privacy-02", tags: "data privacy variant, GDPR compliance, privacy regulation" },
  { id: "ibm-pictograms-secure-profile", tags: "secure profile, protected identity, verified identity" },

  // === AI & ANALYTICS ===
  { id: "ibm-pictograms-ai", tags: "artificial intelligence, AI, machine learning, ML, neural network, deep learning" },
  { id: "ibm-pictograms-ai-trust", tags: "AI trust, trustworthy AI, reliable AI, AI safety" },
  { id: "ibm-pictograms-ai-transparency", tags: "AI transparency, explainable AI, XAI, model interpretability" },
  { id: "ibm-pictograms-ai-robustness", tags: "AI robustness, adversarial robustness, model robustness, resilient AI" },
  { id: "ibm-pictograms-ai-governance-model", tags: "AI governance, model governance, AI policy, ML model management" },
  { id: "ibm-pictograms-ai-privacy", tags: "AI privacy, federated learning, differential privacy, private ML" },
  { id: "ibm-pictograms-ai-ethics", tags: "AI ethics, fair AI, bias detection, responsible AI" },
  { id: "ibm-pictograms-ai-explainability", tags: "AI explainability, model explanation, feature importance, SHAP, LIME" },
  { id: "ibm-pictograms-robot", tags: "robot, autonomous agent, bot, automated system, robotic" },
  { id: "ibm-pictograms-robotics", tags: "robotics, robotic arm, automation, industrial robot" },
  { id: "ibm-pictograms-chart-radar", tags: "radar chart, spider chart, performance metrics, multi-axis chart, evaluation" },
  { id: "ibm-pictograms-analytics", tags: "analytics, data analysis, statistics, metrics, KPI, dashboard" },
  { id: "ibm-pictograms-analyze", tags: "analyze, inspection, examination, magnifying glass, investigation" },

  // === CLOUD ===
  { id: "ibm-pictograms-cloud", tags: "cloud, cloud service, cloud platform" },
  { id: "ibm-pictograms-cloud-computing", tags: "cloud computing, IaaS, PaaS, SaaS, cloud infrastructure" },
  { id: "ibm-pictograms-cloud-pak-for-security", tags: "cloud security platform, cloud security suite, CASB" },
  { id: "ibm-pictograms-cloud-pak-for-network-automation", tags: "cloud network automation, SDN, NFV, network orchestration" },
  { id: "ibm-pictograms-hybrid-cloud", tags: "hybrid cloud, multi-cloud, cloud integration, edge-cloud" },
  { id: "ibm-pictograms-cloud-download", tags: "cloud download, download from cloud, pull data" },
  { id: "ibm-pictograms-cloud-upload", tags: "cloud upload, upload to cloud, push data" },
  { id: "ibm-pictograms-cloud-storage", tags: "cloud storage, object storage, S3, blob storage" },
  { id: "ibm-pictograms-confidential-computing", tags: "confidential computing, TEE, secure enclave, trusted execution, SGX" },

  // === DATA ===
  { id: "ibm-pictograms-big-data", tags: "big data, large dataset, massive data, data volume" },
  { id: "ibm-pictograms-data-transfer", tags: "data transfer, data exchange, data migration, data flow" },
  { id: "ibm-pictograms-streaming-data", tags: "data streaming, real-time data, live feed, event stream, Kafka" },
  { id: "ibm-pictograms-document-security-02", tags: "secure document, protected file, encrypted document, classified document" },
  { id: "ibm-pictograms-api", tags: "API, interface, REST, endpoint, web service, microservice" },

  // === BLOCKCHAIN ===
  { id: "ibm-pictograms-blockchain", tags: "blockchain, distributed ledger, chain of blocks, immutable record" },
  { id: "ibm-pictograms-blockchain-02", tags: "blockchain variant, DLT, smart contract, decentralized" },

  // === QUANTUM ===
  { id: "ibm-pictograms-quantum-computer", tags: "quantum computer, qubit, quantum processor, quantum hardware" },
  { id: "ibm-pictograms-quantum-computing", tags: "quantum computing, quantum algorithm, quantum circuit" },

  // === LOCATION ===
  { id: "ibm-pictograms-location", tags: "location, GPS pin, map marker, geolocation, position" },
  { id: "ibm-pictograms-globe-locations", tags: "global locations, worldwide sites, geographic distribution" },

  // === SCIENTIFIC ===
  { id: "ibm-pictograms-scientific-research", tags: "scientific research, experiment, lab, research, academic" },
  { id: "ibm-pictograms-scientific-computing", tags: "scientific computing, simulation, numerical methods, HPC science" },
] as const;

function iconCatalogDocs(): string {
  return ICON_CATALOG.map((i) => `- ${i.id}: ${i.tags}`).join("\n");
}

// ---------------------------------------------------------------------------
// Shared building blocks (each rule lives in exactly one section).
// ---------------------------------------------------------------------------

function textInventory(): string {
  return `## Text Elements — emit like dropping a preset

Text boxes work like the editor's sidebar presets: pick a **variant** and write the **content**. The server fills in \`fontSize\`, \`fontWeight\`, and \`width\` from that variant. You EMIT \`height\` yourself using the planning table in the Planning height & cascade reflow subsection (1/2/3-line values per variant) — the browser re-measures on first paint and the cascade reflow corrects any drift. Do NOT compute text dimensions by font metrics; read the planning table.

**Read order when analyzing a text box in the sketch: content → style (variant + color + fill/stroke/borderRadius) → width → inter-sentence spacing → height (from planning table).** Ignore the box's visible top / bottom padding from the sketch; emit height by counting the lines your content will wrap to at the chosen width and reading the matching row from the planning table. The rendered box hugs its content and snaps UP to the nearest 5px on the browser's first-mount measurement (e.g. a 107px-intrinsic box becomes 110). See sketch-analysis Step 5 for the expanded read-order rubric.

### The four variants (fixed preset widths)
| variant    | role                                                  | width |
|------------|-------------------------------------------------------|-------|
| heading    | Figure title (one per figure)                          | 280   |
| subheading | Free-standing section title (outside any container)    | 240   |
| body       | Step label, container header, actor shape-head label   | 240   |
| caption    | Icon label, axis label, actor caption, message label, note body | 160 |

**Default text colors** (used unless the sketch indicates otherwise): heading / subheading / body — #1e293b. caption — #475569. Arrow annotation (fontSize 11, overridden inline, not a variant) — #64748b.

Every text element includes a \`"variant": "heading"|"subheading"|"body"|"caption"\` field. Omit \`fontSize\`, \`fontWeight\`, \`width\`, and \`fontFamily\` from the JSON — the server fills all of them from the variant preset. EMIT \`height\` from the planning table below, picking the row that matches the line count you expect at the element's width. The browser re-measures on first paint, so your number is a placeholder — the cascade reflow shifts downstream elements by (measured − emitted) so gaps are preserved. The canonical font stack (\`'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif\`) is forced by the server so the browser's measurement matches the font the planning-table values assume.

### Positioning against a preset-sized box
Since widths are fixed per variant, use these constants when centering a text on a parent:
- heading ⇒ 280, subheading ⇒ 240, body ⇒ 240, caption ⇒ 160.
- \`text.x = round_to_5(parent_center_x − variant_width / 2)\`.
- Emit \`height\` from the planning table, and use the SAME value in the math that picks the next element's top. The browser re-measures after first paint and the cascade reflow shifts downstream elements to match the real bottom.

### Width overrides (only when the preset is wrong)
Emit an explicit \`width\` ONLY when the content genuinely doesn't belong at the preset width:
- Long multi-line note bodies wider than 160.
- Full-width span notes (form 7c in sequence diagrams — width computed from lifeline anchors).
- Wide custom pills / phase markers.

For these, emit \`width\` divisible by 5 (ceil_to_5). Emit \`height\` from the planning table using the line count you expect at your override width. Pick conservatively — if content might wrap to 3 lines, use the 3-line value; the cascade corrects further growth, but the emitted value is what downstream elements are positioned against.

### The text element's own container styling (fill / stroke / borderRadius)
One text element carries its own background + border + rounded corners. A pill, note, actor head, or highlight band is ONE text element with \`fill\`, \`stroke\`, \`strokeWidth\`, and \`borderRadius\` set on it. Never emit rectangle + text pairs for rectangular containers — see the "FORBIDDEN: rectangle-behind-text pattern" note in Grouping.
- Plain caption / label: \`fill "none"\`, \`stroke "none"\`, \`strokeWidth 0\`, \`borderRadius 0\`.
- Bordered note / pill / actor head: copy fill + stroke + strokeWidth (1 or 1.5) + borderRadius (0 sharp, 4–8 pills) from the sketch.

### verticalAlign
- Default "top". Since the browser re-measures height to fit content exactly, "top" and "middle" render identically for body-only boxes.
- "middle" when a parent locks the height (matching sibling rows).
- "bottom" for text sitting at the floor of an explicitly tall container.

### Planning height & cascade reflow
EMIT the \`height\` for every text element using the planning table below — pick the row that matches how many visual lines your content will wrap to at the element's width. After render, the BROWSER re-measures the intrinsic height on first paint (via \`scrollHeight\` with the declared \`min-height\` temporarily stripped); a client-side cascade reflow then shifts every downstream element by (measured − emitted) so gaps to the REAL bottom are preserved. Drift in either direction is fine: wrapping to an extra line pushes followers DOWN; fitting in fewer lines pulls followers UP.

Use the SAME planning-table value for (a) the element's \`height\` field AND (b) the math that picks the next element's top. They MUST agree or the cascade over/under-shifts. Values are the exact snap-to-5 result for \`strokeWidth 2\` (bordered note / pill). Stroke-less or thinner-stroked text lands 0 or 5px shorter — the cascade absorbs that delta, so use these numbers regardless of stroke. Use the 3-line value for any text you expect to wrap to 3+ lines; the cascade pushes further if it wraps more.
- **Per-variant plan-time height (line count = how many visual rows the wrapped content takes).** Values are \`ceil_to_5(fontSize × 1.2 × lineCount + 8)\` — matches the browser's \`scrollHeight\` under the canonical font stack so the cascade reflow delta is ~0:
  - caption (12px): 1 line = 25, 2 lines = 40, 3+ lines = 55.
  - body (16px): 1 line = 30, 2 lines = 50, 3+ lines = 70.
  - subheading (20px): 1 line = 35, 2 lines = 60, 3+ lines = 80.
  - heading (24px): 1 line = 40, 2 lines = 70, 3+ lines = 95.
- Cascade rules (general case): shifts every element whose ORIGINAL top sits at or below the text's EMITTED bottom AND whose x-range overlaps the text's. No distance cap — a 7-line note emitted as 3 lines still pushes all downstream messages down by the right amount. Elements ABOVE the text are untouched.
- Sequence-diagram override (detected automatically when ≥2 vertical lifelines are present): the x-column check is DROPPED so a side note on one actor's column still shifts every message row below it — preserves emission order across columns. Lifeline endpoints are checked per-endpoint: top stays anchored on the actor head, bottom extends to cover the grown content.`;
}

function elementTypeDocs(): string {
  return `## Element Type Reference

### Rectangle
\`{ "id", "type": "rectangle", "x", "y", "width", "height", "rotation": 0, "fill": "<hex|none>", "stroke": "<hex|none>", "strokeWidth", "strokeStyle"?: "solid"|"dashed"|"dotted", "opacity": 1, "zIndex", "borderRadius", "aspectLocked"?: false }\`
- strokeStyle: omit (= "solid") unless the sketch shows a broken or dotted border. "dashed" for broken lines, "dotted" for dotted borders. Applies to any element with a stroke.

### Circle (always round)
\`{ "id", "type": "circle", "x", "y", "width", "height", "rotation": 0, "fill", "stroke", "strokeWidth", "opacity": 1, "zIndex", "aspectLocked": true }\`
width MUST equal height. Emit them equal; the post-processor widens the shorter side if not.

### Line / Arrow (connectors)
\`{ "id", "type": "arrow", "x", "y", "x2", "y2", "width": 0, "height": 0, "rotation": 0, "fill": "none", "stroke": "<hex>", "strokeWidth": 2, "opacity": 1, "zIndex", "headStyle": "triangle"|"open"|"none", "tailStyle": "none"|"triangle"|"open", "lineStyle": "straight"|"curved"|"elbow", "sourceLabel"?: "<string>", "label"?: "<string>", "targetLabel"?: "<string>" }\`
\`{ "id", "type": "line", "x", "y", "x2", "y2", "width": 0, "height": 0, "rotation": 0, "fill": "none", "stroke": "<hex>", "strokeWidth": 2, "opacity": 1, "zIndex", "headStyle": "none", "tailStyle": "none", "lineStyle": "straight"|"curved"|"elbow", "label"?: "<string>" }\`
- "arrow" = directional (default headStyle "triangle"). "line" = non-directional (default headStyle "none").
- Both support the same lineStyle / headStyle / tailStyle.
- Endpoints sit ON an element edge — see Position Planning Step E. The server auto-fills startDir / endDir AND startConnectedTo / endConnectedTo from coordinates: when an endpoint lands within one grid tick of an element edge, the server records the element id as the binding so the renderer reroutes the connector when its target is moved or resized later. You don't need to do anything to opt in — emit the endpoint coords on the edge and the binding is set for you.
- NEVER emit startConnectedTo / endConnectedTo / cx / cy / elbowCorners yourself. Those are server- or editor-managed (bindings filled in post-snap; cx/cy and elbowCorners are interactive-editor state for curve control points and custom elbow bends). The renderer auto-routes curves and elbow corners from the endpoints + startDir / endDir.
- rotation is always 0 for lines/arrows. The visible angle is derived from (x, y) → (x2, y2); set it with the endpoints, not a rotation field.

### Text
\`{ "id", "type": "text", "variant": "heading"|"subheading"|"body"|"caption", "x", "y", "rotation": 0, "fill": "<hex|none>", "stroke": "<hex|none>", "strokeWidth": 0|1|1.5, "opacity": 1, "zIndex", "content": "...", "fontStyle": "normal", "textAlign": "center"|"left"|"right", "verticalAlign": "top"|"middle"|"bottom", "color": "<hex>", "borderRadius": 0 }\`
- OMIT \`fontSize\`, \`fontWeight\`, and \`fontFamily\`. The server fills these from the variant preset + the canonical font stack. Width is also filled from the preset; emit \`width\` only as an explicit override (full-span notes, oversized pills). EMIT \`height\` using the planning-table value matching your content's expected line count (see Text Elements → Planning height & cascade reflow). The browser re-measures on first paint and the cascade reflow corrects any drift — your emitted value is the placeholder downstream elements are positioned against.
- verticalAlign: "top" for plain labels and notes (text hugs the top of the box). "middle" for pills / badges / actor heads (text centered inside the pill). "bottom" is rarely needed; use when the sketch shows text sitting at the floor of a tall container.
- rotation: -90 for Y-axis labels reading bottom-to-top.
- **fill / stroke / strokeWidth / borderRadius give the text its OWN background, border, and rounded corners** — a bordered / pill / badge / note label is ONE text element with those properties set, NOT a rectangle + text pair. Default fill "none", stroke "none", borderRadius 0 for plain captions.
- A rounded pill (actor head, badge) is still ONE text element — set borderRadius to the desired radius (e.g., 6). Text can now draw rounded corners; rect + text pairs are no longer needed for pills.

**content is rendered as raw HTML via innerHTML.** Embed inline tags to style sub-spans within ONE element. Element-level fontSize / fontWeight / color is the BASE style; inline tags override per-span.

Supported inline tags (round-trip cleanly with the editor's rich-text toolbar):
\`<b>\`, \`<i>\`, \`<u>\`, \`<s>\`, \`<span style="color:#HEX">\`, \`<br>\`. They may nest.

**\`<br>\` rules — every \`<br>\` adds a rendered line that the browser measures, so the box grows vertically to fit exactly what you emit (pick the planning-table row that matches the final line count):**
- Single \`<br>\`: break a deliberate multi-line label (e.g. \`"Encryption Layer<br>TLS 1.3"\`).
- Double \`<br><br>\`: intentional paragraph gap inside ONE note. The blank line consumes one line-height of vertical space — that's the point, and the box hugs it exactly. Use this when the sketch clearly shows two paragraphs separated by whitespace.
- NEVER emit a TRAILING \`<br>\` at the end of content (the server strips it, but a sloppy emission wastes tokens). Content should end at the last visible character.
- Short single-line labels have NO \`<br>\` at all.

Escaping inside the JSON string: \`<\` → \`&lt;\`, \`>\` → \`&gt;\`, \`&\` → \`&amp;\`, \`"\` → escape as \`\\"\` or \`&quot;\`. NEVER emit \`<script>\`, \`<style>\`, event handlers (\`on*\`), or block tags (div, p, h1, table, …).

Per-word emphasis — use inline HTML, NOT a second element:
- Good: \`"content": "<b><span style=\\"color:#22c55e\\">PRACH</span></b> Preamble"\`
- Good: \`"content": "Status: <b style=\\"color:#ef4444\\">FAILED</b>"\`
- Good two-line label: \`"content": "Encryption Layer<br><span style=\\"color:#64748b\\">TLS 1.3</span>"\`
- Plain when one style fits all: \`"content": "Authentication"\`

CRITICAL:
- One text element per label. Two stacked elements to fake mixed styles is forbidden — the post-processor dedupes overlapping texts whose contents are substrings of each other.
- Two text elements may have overlapping bounding boxes ONLY when part of a text-on-shape / flowchart-node composite (shared groupId). Two text elements NEVER overlap each other.
- No two text elements share identical content anywhere on the canvas.

### Icon (IBM pictograms)
\`{ "id", "type": "icon", "x", "y", "width": 48, "height": 48, "rotation": 0, "fill": "none", "stroke": "none", "strokeWidth": 0, "opacity": 1, "zIndex", "iconId": "<id>", "color": "#1a1a1a" }\`
Use 40×40 only for dense diagrams; never smaller.

### Frame (hierarchical container)
\`{ "id", "type": "frame", "x", "y", "width", "height", "rotation": 0, "fill": "none"|"<hex>", "stroke": "none"|"<hex>", "strokeWidth": 0|1|1.5, "opacity": 1, "zIndex", "cornerRadius": 0|number, "clipContent": false }\`
A frame is a NAMED SECTION of the figure. It groups related children under one parent so downstream tools can reason about the figure as a tree — "these three icons + labels make up the Authentication phase" — not a flat bag of 12 primitives. Prefer a frame over an L1 outline rectangle when the contents belong together semantically.

How to wire up children: emit each child with \`parentId\` set to the frame's id. The server derives the frame's childIds from those references — **DO NOT emit childIds on the frame yourself**. Children keep using ABSOLUTE canvas coordinates (frame.x/y/width/height is the container; child.x/y is still in page space, not frame-relative).

Do NOT emit layoutMode, gap, padding, mainAxisAlign, or crossAxisAlign — the server fills those with inert defaults and the renderer ignores them today.

Frame styling:
- fill "none" + stroke "<hex>" + borderRadius 10: classic outline section (replaces the old "rectangle L1 container + separate label" pattern).
- fill "<soft hex>" (e.g. "#f8fafc") + stroke "none": tinted section tile.
- fill "none" + stroke "none": invisible grouping node (use when the tree structure matters but no visible border is needed).
- clipContent: always \`false\` unless the sketch explicitly crops overflow at the container boundary. True clips children to frame bounds via an SVG clipPath.

### Path (custom SVG — waveforms, charts, flowchart presets)
\`{ "id", "type": "path", "x", "y", "width", "height", "rotation": 0, "fill": "<hex|none>", "stroke": "<hex>", "strokeWidth": 2, "opacity": 1, "zIndex", "pathData": "<SVG d>", "viewBox": "0 0 W H", "aspectLocked"?: true }\`

CRITICAL viewBox rules (renders with preserveAspectRatio="none" + vector-effect="non-scaling-stroke"):
1. element.width / element.height MUST equal viewBox_W / viewBox_H. Because the renderer uses preserveAspectRatio="none", mismatched ratios STRETCH the path to fill the bounding box — a diamond squashes into a rhombus, a cloud tilts. Flowchart preset paths set aspectLocked: true to prevent drift after the user resizes, but the initial emission still needs matching ratios.
2. viewBox must TIGHTLY bound the path's actual extents (path touches viewBox on all four sides) — unless it is intentionally a sub-region highlight band.
3. The element's (x, y, width, height) IS the visual bounding box — use it directly for alignment. Stroke thickness stays constant under stretch thanks to non-scaling-stroke.

Path examples (tight viewBox + matching aspect ratios):
- Sine (4 cycles, 2:1): pathData \`M 0 50 Q 25 -50, 50 50 Q 75 150, 100 50 Q 125 -50, 150 50 Q 175 150, 200 50\`, viewBox \`0 0 200 100\`.
- Horizontal axis: pathData \`M 0 0 L 200 0\`, viewBox \`0 0 200 1\`, strokeWidth 1.5 (element e.g. 200×2).
- Highlight band (sub-region): pathData \`M 40 0 L 120 0 L 120 100 L 40 100 Z\`, viewBox \`40 0 80 100\` (element covers the band itself).

### Shared / Optional Properties
- **aspectLocked** (boolean): keeps width:height ratio on resize. REQUIRED true on circles, flowchart preset paths, icon-background shapes, and any path whose viewBox encodes a meaningful ratio. Omit/false on free rectangles and containers.
- **groupId** (string): joins primitives that move as one composite. See Grouping & Overlap.
- **parentId** (string | null): id of the FRAME this element lives inside, or \`null\` for page-root elements. Only non-null when you have emitted a \`type: "frame"\` element and want this primitive to belong to it. Non-frame elements are NEVER parents — only frames can hold children. See Hierarchy.

## Hierarchy — parentId

Frames turn a flat element list into a TREE. Use them to carve a figure into named sections (one frame per phase / lane / group of related assets) so the structure of your figure is legible from the JSON alone.

Rules:
1. Only a \`type: "frame"\` element can be a parent. Primitives (rect, circle, text, icon, path, line, arrow) cannot hold children.
2. Every non-root element sets \`parentId\` to an existing frame's id. Everything else omits \`parentId\` (or sets it to \`null\`) — those render at page root.
3. The frame's \`childIds\` is derived server-side from children's \`parentId\`. **DO NOT emit childIds yourself.**
4. Children use ABSOLUTE canvas coordinates (current step). Frame.x / frame.y is the visible bounding box of the section; child.x / child.y are still in page space. A child sitting at frame.x + 20, frame.y + 40 is 20px inside the frame's left edge, 40px inside the top. Do NOT use frame-relative offsets.
5. A child's \`zIndex\` orders it against other elements INSIDE the same frame. A frame's own \`zIndex\` orders the whole section against other page-root elements.
6. A frame's bounding box (x, y, width, height) should tightly enclose its children's combined bounding boxes with a small inner padding (10–20px). Compute the box AFTER placing children — same math as Position Planning Step D for L1 containers.
7. Lines / arrows connecting elements WITHIN one section: emit with \`parentId\` = that frame's id. Lines / arrows crossing section boundaries: emit with \`parentId: null\` (they belong to the page, not any one section).

When to reach for a frame vs. leave it flat:
- Figure has obvious sections (phases, lanes, regions, subsystems, before/after panels) → one frame per section.
- Figure is a single tight diagram (single flowchart, one sequence diagram) → flat is fine, skip frames.
- You were about to emit a "L1 container" outline rectangle with a section header: emit a frame instead and put the header text + section primitives as its children.

Frame styling mirrors the old L1 container palette (stroke colors #93c5fd / #fcd34d / #86efac / #f9a8d4 / #c4b5fd / #94a3b8; borderRadius 10). A section header (Body-bold, color matching the stroke family) sits near the frame's top-left corner and IS one of the frame's children (parentId = frame.id).`;
}

function canvasAndGrid(): string {
  return `## Canvas, Grid & Proportions

### Snap grid — 5px (MANDATORY)
All x, y, x2, y2, width, height, borderRadius values MUST be divisible by 5.
- Position (x, y, x2, y2): \`round_to_5(v) = Math.round(v / 5) * 5\` — nearest-round is fine (drift is symmetric).
- **Size (width, height): \`ceil_to_5(v) = Math.ceil(v / 5) * 5\` — ALWAYS ROUND UP.** Never nearest-round, never floor for width/height. Rationale and text-sizing formulas: see Text Inventory.
- borderRadius: nearest-round is fine.
fontSize: prefer 11, 12, 16, 20, 24 (the variants); 10 is the floor.

### Canvas
- 1200×800 px. Usable area 80–1120 × 60–740 (60px margins).
- Figure target: 500–750px wide, 350–550px tall. Never exceed 800 wide.
- figure_left_x = 600 − total_width/2 (horizontally centered).
- Figure occupies 25–45% of canvas area.

### Proportion targets
- Icon : label : title ≈ 48 : 12 : 24 (4 : 1 : 2). Shrink the layout, not the text.
- Label cap-height ≈ 25–33% of icon height.
- < 6 primary assets → 500–600px wide. 6–10 → 600–750px. > 10 → add rows, don't widen.
- Column spacing (center-to-center): 110–150px for icon+label; tighten to 90px for ≥4 columns.
- Row spacing (center-to-center): 90–120px for icon+label, 70–90px for label-only.
- Minimum edge-to-edge gap between neighbor cells: 15–20px horizontally, 20–25px vertically.`;
}

function positionPlanning(): string {
  return `## Position Planning

Compute every coordinate from grid anchors. Never eyeball.

### Step A — Grid
Pick a layout origin (top-left of the figure's content). Assign each column an x-anchor and each row a y-anchor. Spacing uniform and compliant with the rules in Canvas, Grid & Proportions (cols 110–150px, rows 90–120px).
Example (3 cols × 2 rows, 130px col spacing, 110px row spacing, centered on x=600):
- col1_x = 470, col2_x = 600, col3_x = 730
- row1_y = 260, row2_y = 370
All elements in a column share center-x; all in a row share center-y (±0px).

### Step B — Place assets on anchors
- \`element.x = round_to_5(col_x − element.width/2)\`
- \`element.y = round_to_5(row_y − element.height/2)\`
A 48×48 icon at (470, 260) lands at (445, 235) — (470 − 24, 260 − 24) each rounded to 5. Using widths divisible by 10 (e.g., 50 or 80) makes anchors land exactly on 5-grid without rounding.

### Step C — Labels relative to parent
Text widths come from the variant preset (heading 280, subheading 240, body 240, caption 160). Emit \`height\` from the planning table in Text Elements; the browser re-measures on first paint and the cascade reflow corrects drift.
Below (most common): \`label.x = round_to_5(parent.x + parent.width/2 − variant_width/2); label.y = round_to_5(parent.y + parent.height + 8); textAlign "center"\`.
Above: \`label.y = round_to_5(parent.y − estimated_height − 8)\`.
Y-axis vertical: rotation -90, \`x = round_to_5(chart.x − 25)\`, \`y = round_to_5(chart.y + chart.height/2)\`.
Worked example: icon at (445, 235), size 48×48, caption variant (width 160) →
  label.x = round_to_5(445 + 24 − 80) = 390, label.y = round_to_5(235 + 48 + 8) = 290. Caption center-x = icon center-x.

### Step D — Container bounds (after placing every child)
Let \`contents\` = every element visually inside the container. For text children, use the variant preset width for \`c.width\` and the planning-table height you EMITTED as the text's \`height\` for \`c.height\`. The browser's real measurement is within a few pixels, and the cascade reflow absorbs any gap — but your container bounds must match what you emitted, not what you hope will be measured. padX = padY = 25. The −20 / +20 reserves a 45px-tall band at the top for the container's section header.
- \`container.x = round_to_5(min(c.x for c in contents) − padX)\`
- \`container.y = round_to_5(min(c.y for c in contents) − padY − 20)\`
- \`container.width = round_to_5(max(c.x + c.width for c in contents) − min(c.x) + 2*padX)\`
- \`container.height = round_to_5(max(c.y + c.height for c in contents) − min(c.y) + 2*padY + 20)\`
The header MUST be fontSize 16 (Body-bold) so it fits the 45px band; Subheading (20) inside a container collides with the topmost child. Reserve Subheading for free-standing, free-standing section titles outside any container.

### Step E — Arrow endpoints (EDGE SNAP)
Every endpoint sits on one of the target's four edges:
- Top:    \`y = element.y\`,                  \`x ∈ [element.x, element.x + element.width]\`       → dir "up"
- Right:  \`x = element.x + element.width\`,  \`y ∈ [element.y, element.y + element.height]\`      → dir "right"
- Bottom: \`y = element.y + element.height\`, \`x ∈ top range\`                                   → dir "down"
- Left:   \`x = element.x\`,                  \`y ∈ right range\`                                 → dir "left"

The perpendicular (fixed) coord equals the edge line EXACTLY — no safety margin. The along-edge coord MUST be divisible by 5 and within the edge's extent; default to the nearest 5px position to the edge midpoint. A 48-wide icon at x=80 has midpoint 104 — pick 105.

Facing-edge table for A → B:
| Relationship      | Start on A    | End on B     |
|-------------------|---------------|--------------|
| A left-of B       | right edge    | left edge    |
| A right-of B      | left edge     | right edge   |
| A above B         | bottom edge   | top edge     |
| A below B         | top edge      | bottom edge  |

Multiple arrows converging on one element: spread endpoints along the edge on 5px steps (e.g., x+10, x+25, x+40). Route to a container's bounding box, not its individual children, when crossing groups.

### Consistency
- Same-row center-y identical to ±0px. Same-column center-x identical to ±0px.
- Column spacing uniform; row spacing uniform.
- Sibling containers: same height when holding similar content.`;
}

function sequenceDiagramLayout(): string {
  return `## Sequence / Protocol Diagram Layout
For any figure with actors at the top and messages flowing vertically between lifelines. Whitespace between lifelines kills readability — do NOT stretch horizontally. This layout has its OWN column-spacing rule that overrides Canvas, Grid & Proportions; everything else (snap-5, edge-snap, zIndex, groupId) still applies without exception.

### Build order — skeleton first, content second
Emit each text element's \`height\` from the Text Elements planning table (see Planning height & cascade reflow). Plan conservatively — use the 3-line row when content may wrap past 2 lines. Order the layout in THIS exact sequence; do not interleave the phases:

1. **Skeleton (sections 1–2 below).** Pick lifeline anchors, place actor heads at the top, drop the lifeline \`line\` elements down the page. Leave each lifeline's \`y2\` as a provisional value — you'll set the real one in phase 3.
2. **Inner content (sections 3–7 below).** Place message rows along the y-axis; their labels above each arrow; notes / bands / activation bars in the gaps between rows. Every \`x\` / \`x2\` is already fixed by the anchors — inner content only chooses \`y\` values and (for notes) widths. When a note sits in the gap between message \`k\` and \`k+1\`, plan row \`k+1\` using the SAME planning-table height value you emitted for the note (cascade reflow shifts all rows below if measured height exceeds planned — uniform \`row_h\` stays valid).
3. **Close the skeleton.** After the last row is placed, set every lifeline's \`y2\` per the rule in section 2 (\`round_to_5(last_message_y + 40)\`, or past the last attached note, whichever is lower). All lifelines share the same \`y2\`.

Rationale: the actors + lifelines form a fixed x-grid that every message, label, and note snaps to. Placing a message before fixing its anchors lets endpoints drift; sizing a lifeline before knowing the last row either clips content or leaves a dead tail.

### 1. Pick lifeline anchors (the master x-axis)
For each actor i, fix ONE anchor \`lifeline_x[i]\` divisible by 5. Every downstream coordinate (actor icon, actor label, lifeline endpoints, every message endpoint, activation bars, self-loops) is derived from this anchor — nothing is eyeballed.
- Lifeline center-to-center: 180–220px (2–3 actors); 160–180px (4 actors); NEVER exceed 250px.
- Figure width = (actor_count − 1) × spacing + 48 + 2×padding. Center on canvas: \`lifeline_x[0] = round_to_5(600 − ((actor_count − 1) × spacing) / 2)\`. Each next \`lifeline_x[i] = lifeline_x[i−1] + spacing\`.

### 2. Actor heads — pick ONE of two forms, use it for EVERY actor in the diagram
Consistency matters: don't mix icon-heads with shape-heads in one figure. Match the sketch. Every actor shares ONE groupId with its lifeline (e.g., "actor_1"). Colors, fills, borderRadius values all come from the sketch — do not invent.

**Form A — Icon + label below** (when the sketch shows an icon/pictogram as the actor):
- Icon: 48×48, zIndex 15. \`icon.x = lifeline_x[i] − 24\`, \`icon.y = 80\`. round_to_5 both.
- Actor label: variant "caption", textAlign "center", zIndex 28. Caption width = 160 (preset). \`label.x = round_to_5(lifeline_x[i] − 80)\`, \`label.y = round_to_5(icon.y + 48 + 8)\` = 135.
- Icon + label + lifeline share groupId.

**Form B — Shape head (pill / rectangle / rounded rectangle)** (when the sketch shows a bordered/filled box with an actor name inside, e.g., "Initiating SEPP (PLMN A)"):
ONE text element, always. The text element's own fill / stroke / strokeWidth / borderRadius draws the box — sharp corners (borderRadius 0) AND rounded corners (borderRadius ≥ 4) are both native to the text element. Do NOT emit a rectangle behind the text — that produces a doubled border.
- variant "body" (width 240), textAlign "center", verticalAlign "top", zIndex 28. Server fits height to content.
- \`text.x = round_to_5(lifeline_x[i] − 120)\`, \`text.y = 60\`. Use \`<br>\` for multi-line names.
- fill / stroke / strokeWidth / borderRadius / color all copied from the sketch. For a rounded pill, set borderRadius to the radius the sketch implies (6–12 typical).
- Text + lifeline share groupId.
- **Snapped edge to lifeline:** \`lifeline.y = text.y + planned_head_height\` (same value you emitted as the head text's \`height\`). Edge-snap + cascade reflow absorb any plan-vs-measured drift.

**Lifeline (MANDATORY for both forms — one per actor, no exceptions)**: type "line" (NOT "arrow"), zIndex 11. \`x = x2 = lifeline_x[i]\` (EXACTLY — both endpoints snap to the anchor, no drift). \`y\` sits on the actor head's bottom edge using the planning table (Form A caption 1-line → label.y + 25; Form B body 1-line → text.y + 30, 2-line → text.y + 50). \`y2 = round_to_5(last_message_y + 40)\` (or past the last attached note, whichever is lower). lineStyle "straight", headStyle "none", tailStyle "none". Stroke color and strokeWidth copied from the sketch, or a neutral muted stroke if the sketch is stylized.
  - Without the lifeline, messages read as disconnected floating arrows. If you emit N actors, you MUST emit N lifeline \`line\` elements.

### 3. Messages (horizontal arrows between lifelines)
Each message is ONE "arrow" with lineStyle "straight" (lifelines are vertical → endpoints share y, geometry is aligned). strokeWidth 1.5.
- Vertical rhythm: \`message_y[k] = first_message_y + k × row_h\`, where \`row_h = ceil_to_5(label_height[k+1] + 15)\` and \`row_h\` stays in \`[40, 80]\` — bumped automatically when row \`k+1\`'s label wraps to 2 or 3 lines so the taller label still fits between arrows k and k+1. \`label_height[k+1]\` is the planning-table caption value for the line count row \`k+1\`'s label actually wraps to (25 / 40 / 55 for 1 / 2 / 3 lines). \`first_message_y ≥ lifeline_top_y + label_height[0] + 15\` — the first message's label sits directly below the actor head; the \`+ 15\` = 6px label-to-arrow gap + 9px head-to-label gap.
- **Endpoint snap — THE SINGLE MOST IMPORTANT RULE in this layout.** For a message from actor A to actor B, emit \`x = lifeline_x[A]\` and \`x2 = lifeline_x[B]\` — the SAME integer values you stored for the lifelines, with no arithmetic applied. Forbidden mistakes:
  - ❌ \`x = lifeline_x[A] + 24\` (starting at the icon's right edge) — the arrow detaches from the lifeline and floats to the side of the actor icon.
  - ❌ \`x = lifeline_x[A] + 5\` or any non-zero offset — near-miss values leave a visible gap.
  - ❌ Computing \`x\` from the actor icon's bounding box at all. Arrows connect lifelines, not icons. The icon lives ABOVE the lifeline; the arrow lives on the lifeline.
  - ✅ \`x == lifeline_x[A]\` exactly, \`x2 == lifeline_x[B]\` exactly, both endpoints share \`y == y2 == message_y[k]\`.
  If the arrow's endpoints don't equal the lifeline anchors, the figure reads as "floating arrows next to disconnected actors" — the single most common failure mode in this layout.
- Direction: if A is left-of B, headStyle "triangle" at x2 (right end); if A is right-of B, swap so the arrow still starts at A (x = A's anchor, x2 = B's anchor) — the triangle head is at x2 regardless.
- To distinguish a reply from a request when the sketch shows them differently: vary headStyle ("triangle" vs "open") and/or stroke color as the sketch indicates. Dashed strokes are NOT supported.
- Messages share NO groupId with actors (they connect actors, they don't belong to one).

### 4. Message labels (above each arrow)
- Primary label: variant "caption", **emit \`"width": 200\` explicitly** (message names are longer than actor labels — 200 fits more on one line), fontWeight handled by variant, zIndex 28, textAlign "center". \`midX = round_to_5((x + x2) / 2)\`, \`label.x = round_to_5(midX − 100)\`, \`label.y = round_to_5(message_y[k] − label_height[k] − 6)\`. \`label_height[k]\` is the planning-table caption value for the line count this label will wrap to: **25** (1 line), **40** (2 lines), **55** (3+ lines). Pick by counting \`<br>\` tags AND estimating soft wraps at width 200 — a label with more characters than will fit on one 200-wide line MUST use the 2-line value, or it overflows downward onto its own arrow. The label's bottom always lands exactly 6px above the arrow regardless of line count.
- **fill / stroke — copy from the sketch.** Default to fill "none" and stroke "none" when the sketch shows a plain floating label. If the sketch draws the label inside a filled pill / bordered container, copy those colors exactly (fill + stroke + strokeWidth + borderRadius on the text element). Heads-up: a colored fill will paint opaquely over the lifeline segment behind the label — this is fine when the sketch shows it, but avoid an unintended fill that silently breaks a lifeline you meant to keep visible.
- Optional parameter sub-label: caption variant, monospace family, textAlign "center". Positioned 4px below primary: \`sub.y = primary.y + 20 + 4\`. Same fill / stroke rule as the primary label — copy from the sketch.
- Labels are NOT in any groupId (they float above a connector, they don't belong to an actor or message composite).
- DO NOT emit a rectangle element behind the label "to hide" the lifeline crossing — leave the lifeline visible. The lifeline is the backbone of the diagram; obscuring it is a bug.

### 5. Activation bars (optional — when a call spans multiple messages on one lifeline)
Narrow rectangle straddling the lifeline to mark "actor is processing."
- \`bar.x = lifeline_x[i] − 5\`, \`bar.width = 10\` — SYMMETRIC on the anchor so message endpoints at x = lifeline_x[i] don't get snapped to the bar's left/right edge by the server's edge-snap pass (threshold 5px, tie-broken OUT of snapping when exactly at threshold).
- \`bar.y = first_inbound_message_y\`, \`bar.height = round_to_5(last_outbound_message_y − first_inbound_message_y)\`.
- zIndex 12 (above lifeline and message arrows, below notes). fill / stroke / strokeWidth copied from the sketch.
- Shares the actor's groupId — bar sits on the lifeline.

### 6. Self-loops (actor sends message to itself)
- If the loop is shown as a curved arrow in the sketch: ONE curved arrow element, \`x = lifeline_x[i], y = message_y[k] − 8, x2 = lifeline_x[i], y2 = message_y[k] + 8\`, lineStyle "curved".
- If the loop is shown as a side-label: ONE text element parked beside the lifeline. Sharp OR rounded corners both live on the text element (fill / stroke / strokeWidth / borderRadius copied from the sketch). No groupId.

### 7. Notes (state boxes / computation descriptions / preconditions)
A "note" is a bordered box with text describing what an actor knows, computes, or decides. Notes ALWAYS sit in the vertical gap BETWEEN adjacent message rows — never on the same y as a message arrow (which would block the arrow stroke). Notes may visually cover segments of lifelines they sit on top of — this is intentional and correct; the lifeline re-appears above and below the note. (See "Non-overlap carve-out" at the bottom of this section.)

**Note rendering — ALWAYS one text element:**
- ONE text element. Its own fill + stroke + strokeWidth + borderRadius draw the box. Sharp corners AND rounded corners are both native to the text element — do NOT emit a separate rectangle behind it. zIndex 14.
- All visual properties (fill, stroke, strokeWidth, borderRadius, text color, fontSize) copied from the sketch. For rounded notes, set borderRadius on the text element (typical 4–8).
- Multi-line content: use \`<br>\` inside the \`content\` string. textAlign typically "left" for multi-line.
- Colored emphasis within one note (e.g., "Option (a)" keywords in a distinguishing color): use inline \`<b><span style="color:#HEX">…</span></b>\` — copy the HEX from the sketch.
- **Sizing: notes use variant "caption" (width 160 default).** For wider notes, emit an explicit \`width\` divisible by 5 (see constraints below). Emit \`height\` from the planning table using the line count at your width.

**Three placement forms — pick by which lifelines the note concerns:**

**7a. Side note — concerns ONE actor, sits to its side**
- x (left of lifeline): \`note.x = round_to_5(lifeline_x[i] − gap − note.width)\`, gap ≥ 15.
- x (right of lifeline): \`note.x = round_to_5(lifeline_x[i] + gap)\`, gap ≥ 15.
- Width must fit between this lifeline and its neighbor: \`note.width ≤ lifeline_spacing − 30\`. Caption preset 160 usually fits; shrink content or override width to fit if not.
- No groupId — it doesn't need to "move with" the actor, it sits next to it.

**7b. Straddle note — concerns ONE actor, centered on its lifeline**
- \`note.x = round_to_5(lifeline_x[i] − note.width / 2)\`.
- \`note.width ≤ lifeline_spacing − 20\` so it doesn't bleed into the neighbor lifeline's column.
- The actor's lifeline passes behind the note's opaque fill — this is correct.
- No groupId.

**7c. Full-width span note — concerns ALL actors / phase marker**
- \`note.x = lifeline_x[0] − 30\`, \`note.width = lifeline_x[last] − lifeline_x[0] + 60\`. This form explicitly overrides the caption preset width because the span is layout-driven. Round both (the −30/+60 is already divisible by 5, so with 5-snapped anchors the results land on-grid).
- **Symmetric overhang — 30px past the leftmost lifeline AND 30px past the rightmost lifeline.** Both ends must extend past their respective lifelines by the SAME amount. An asymmetric span (e.g., starts past the left lifeline but ends exactly at the right lifeline) is a bug — re-check the width calculation.
- textAlign "center", verticalAlign "top" (height matches content).
- Straddles every lifeline; every crossing is an intentional opaque overlap.
- No groupId.

**Y-positioning (all three forms):**
Notes sit in the gap between two message rows OR above the first message / below the last message. EMIT the note's \`height\` using the planning table (1/2/3 lines × caption). The sequence-diagram cascade drops the x-column check (see Planning height & cascade reflow in Text Elements), so a side note on one actor's column pushes every row below it across all columns as one unit — emission order is preserved. Pick the planning-table row matching the content's line count; don't predict the real note height yourself.

- Between messages \`k\` and \`k+1\`: \`note.y = round_to_5(message_y[k] + 12)\`, emit \`note.height = planned_note_h\` from the table, set the next row \`message_y[k+1] = round_to_5(note.y + planned_note_h + 12 + label_height[k+1] + 6)\` — the trailing \`label_height[k+1] + 6\` reserves space for row \`k+1\`'s label (caption 1/2/3-line = 25 / 40 / 55, plus 6px label-to-arrow gap) so the label fits between the note's bottom and its own arrow. Use the correct value for however many lines row \`k+1\`'s label wraps to. Multi-line notes use the 3-line value; the cascade shifts row \`k+1\` (and every row below) down when the real height exceeds planned.
- Above first message (initial state note): \`note.y = round_to_5(lifeline_top_y + 4)\`, emit \`note.height = planned_note_h\`, then \`first_message_y = round_to_5(note.y + planned_note_h + 12 + label_height[0] + 6)\` — same reservation so the first message's label fits under the note.

### 8. Highlight bands (tinted horizontal strip marking a sub-phase, when shown in the sketch)
A band is visually the same as a full-width note but short and tinted. ONE text element — set fill, stroke, strokeWidth, borderRadius from the sketch. zIndex 13 (above lifeline, below notes).
- Spans all lifelines: \`x = lifeline_x[0] − 30\`, \`width = lifeline_x[last] − lifeline_x[0] + 60\`.
- textAlign "center". Fill / stroke / color copied from the sketch.
- Y between message rows, same rules as notes.

### 9. Section frames (group related messages visually)
Use an L1 container (rectangle element) wrapping everything in the section. NOT a text element.
- fill "none" (so contents inside remain visible). Stroke, strokeWidth, borderRadius copied from the sketch. zIndex 3.
- Dashed outlines are NOT supported by rectangles in this editor — use a solid stroke. Color distinguishes the frame from content.
- Bounds computed per Position Planning Step D around every element in the section (notes, messages, bands).
- Frame header: one text element at \`(container.x + 14, container.y + 10)\`, Body-bold, textAlign "left", zIndex 28. fill / stroke / strokeWidth / borderRadius and text color all copied from the sketch — plain label → fill "none", stroke "none"; tinted pill header → copy the colors.
- Frame does NOT share groupId with its contents.

### 10. Legend / key (when the sketch shows one)
Pinned to an empty area indicated by the sketch.
- Outer container: L1 rectangle, fill "none", stroke from the sketch, zIndex 3. Size chosen to fit entries.
- Per entry (vertically stacked):
  - Swatch: small rectangle (typically 12×12) whose fill is the option's color from the sketch. stroke, borderRadius copied from the sketch. zIndex 10.
  - Label: one text element right of the swatch, zIndex 28. fill / stroke / text color copied from the sketch — plain label → fill "none", stroke "none".
  - Swatch + label share a per-entry groupId (e.g., "legend_opt_a").
- Entry row i y-anchor: \`container.y + top_pad + i × row_step\` (row_step ≈ 22 or whatever the sketch suggests). Swatch at \`container.x + left_pad\`; label right of swatch with ~8px gap.

### 11. Title
One text element, variant "heading", textAlign "center". \`y = 35\`, \`x = round_to_5(600 − 140)\` = 460 (heading width 280, centered on canvas x=600). fill / stroke / borderRadius copied from the sketch — plain title → fill "none", stroke "none"; banner-style title → copy the colors. No actor/message/label overlaps the title's bounding box.

### Non-overlap carve-out for sequence-diagram notes and bands
The canvas-wide non-overlap rule (Grouping section) has carve-outs in sequence diagrams:
- **Notes (zIndex 14), highlight bands (zIndex 13), activation bars (zIndex 12) ARE permitted to overlap lifeline line elements (zIndex 11)** even without a shared groupId — the higher zIndex paints opaquely over the lifeline and the lifeline reappears above and below.
- **Message arrows (zIndex 6–9) ARE permitted to pass under notes and activation bars** — arrows sit below all L3 assets per the layering rule, so the asset cleanly hides the arrow segment that enters its bounding box. The arrow still must not visually start or end WITHIN the bounding box of a non-target asset (endpoints snap only to the intended actors' lifelines).
No other non-groupId overlaps are allowed — notes still can't overlap message labels, other notes, or actor heads.

### Snap & group checklist for this layout
- Every lifeline endpoint x equals the anchor (x == x2, both == lifeline_x[i]).
- Every message endpoint's x equals ONE of the anchors (no "near-miss" values like anchor ± 2).
- Every actor_icon / actor_label / lifeline triplet shares ONE groupId.
- Activation bars share their actor's groupId; messages and message labels do NOT.
- All y values (message rows, lifeline top/bottom, label baselines) divisible by 5.`;
}

function layeringSystem(): string {
  return `## Layering (zIndex)
Every element has a zIndex in exactly one layer. Build bottom-up.

| Layer | zIndex | Contents                                                         |
|-------|--------|------------------------------------------------------------------|
| L0    | 0      | Full-canvas background (rare, usually omitted)                   |
| L1    | 1–5    | Group containers (outline-only rectangles)                       |
| L2    | 6–9    | Arrows, lines (paint BEHIND every asset they snap to)            |
| L3    | 10–20  | Assets: icons, circles, paths, rectangles, lifelines, notes, bands, activation bars |
| L4    | 26–35  | All text labels (titles, captions, section headers, message labels) |

- Ascending zIndex within a layer = later paint = on top.
- **Arrows / lines ALWAYS sit below assets.** An arrow's endpoint visually enters the asset it snaps to — the asset's fill / stroke is painted on top and cleanly hides the last pixel of the arrow body. Picking zIndex 21–25 for an arrow is a bug carried over from earlier versions of this spec.
- NEVER mix layers: a label's zIndex > any asset's; an asset's zIndex > any arrow's; a container's zIndex < any arrow's.`;
}

function arrowRules(): string {
  return `## Arrows, Lines, Connection Styles

JSON shape is in Element Type Reference. Endpoint math is in Position Planning Step E.

### zIndex — always BEHIND the asset(s) the arrow touches
Arrows / lines paint in the 6–9 range, strictly below every asset in L3 (10–20). When an endpoint edge-snaps to an element, the arrow's last pixel disappears behind that element's fill / stroke — this is the correct terminator and the reason arrows live below assets. Default arrow zIndex: **8**. Use 6–7 if a given arrow needs to pass behind another arrow (rare — orthogonal elbows usually avoid this).

Consequence for sequence diagrams: a message arrow that crosses a note's bounding box will be cleanly obscured by the note's fill. That is intentional — the note is foreground context, the arrow is the thread underneath.

### lineStyle — pick by geometry
| Scenario                                     | lineStyle  |
|----------------------------------------------|------------|
| Endpoints same row or same column (aligned)  | "straight" |
| Different row AND column (structured)        | "elbow"    |
| Wireless/radio signal, diagonal arc          | "curved"   |
| Flowchart / process flow with turns          | "elbow"    |

**ONE connection = ONE arrow element**. This is absolute. The editor auto-routes elbows and curves with a single element — you never, EVER compose a connector out of multiple arrows or lines. If the user sees one logical arrow from A → (turn) → B, you emit ONE arrow with \`lineStyle: "elbow"\` whose \`(x, y)\` is on element A's edge and \`(x2, y2)\` is on element B's edge. The router picks the turn. If the connection arcs diagonally (wireless / radio / signal), emit ONE arrow with \`lineStyle: "curved"\`.

DO — one elbow arrow connecting A (right: 300, 150) to B (left: 500, 300):
\`\`\`json
{ "id": "el_a1", "type": "arrow", "x": 300, "y": 150, "x2": 500, "y2": 300, "lineStyle": "elbow", "startDir": "right", "endDir": "left", "stroke": "#64748b", "strokeWidth": 1.5, "headStyle": "triangle", "tailStyle": "none", "zIndex": 8 }
\`\`\`

DON'T — THREE straight arrows faking an elbow (FORBIDDEN — reads as three separate arrows to the user, breaks hover, breaks drag, breaks everything):
\`\`\`json
{ "id": "el_a1", "type": "arrow", "x": 300, "y": 150, "x2": 400, "y2": 150, "lineStyle": "straight", ... }
{ "id": "el_a2", "type": "arrow", "x": 400, "y": 150, "x2": 400, "y2": 300, "lineStyle": "straight", ... }
{ "id": "el_a3", "type": "arrow", "x": 400, "y": 300, "x2": 500, "y2": 300, "lineStyle": "straight", ... }
\`\`\`

Likewise, a wireless-signal arc is ONE curved arrow — not a stack of short straight segments approximating the curve.

Self-check before emitting an arrow/line: trace the path in your head from \`(x, y)\` to \`(x2, y2)\`. If it has any turns or curvature, lineStyle is \`"elbow"\` or \`"curved"\` — NEVER more than one element. If it is a pure straight segment between aligned endpoints, lineStyle is \`"straight"\`.

### Styling
- Stroke palette: #64748b neutral, #ef4444 threat/attack, #3b82f6 data flow, #22c55e success/defense, #f59e0b warning.
- strokeWidth 1.5 standard, 2 for emphasis.
- **Connector labels — use built-in fields, never separate text elements:**
  - Arrows support three optional label fields: \`sourceLabel\` (rendered near the start endpoint), \`label\` (rendered at the midpoint — also editable by double-click in the editor), \`targetLabel\` (rendered near the end endpoint). Use these instead of creating separate \`type: "text"\` elements to annotate connectors.
  - Lines support one optional label field: \`label\` (rendered at the midpoint). Use it instead of a separate text element.
  - Omit any label field whose value would be empty. All three are optional strings.
  - Example: \`{ "type": "arrow", ..., "sourceLabel": "req", "label": "HTTP/2", "targetLabel": "resp" }\``;
}

function groupingSystem(): string {
  return `## Grouping, Containers & Composites

### groupId — joins primitives into one composite
Assign the same "groupId" string to every primitive in a composite so they move as one when edited. The post-processor uses groupId to whitelist intentional overlaps. Containers (L1) do NOT use groupId.

Four use cases — overlap between the members IS intentional because they share groupId:

**A. Composite visual** (waveform, chart, spectrum, subframe display)
1. Background rect: fill "none" or tinted, stroke muted, borderRadius 4, zIndex 10.
2. Data path / inner rects (bars, slots): zIndex 11–12. Path viewBox tight; ratio matches element.
3. Axis labels: Caption variant, Y-axis rotation -90, zIndex 28.
All share groupId (e.g., "wave_1", "chart_2"). Build inside-out.

**B. Text-on-Shape** (label inside a filled/bordered container — process step, pill, badge, sequence-message label)
A text element renders its own container: \`fill\` becomes the background, \`stroke\` + \`strokeWidth\` become the border. DO NOT emit a separate rectangle plus a text element to fake this — use ONE text element with fill/stroke set.
- fill: soft color matching the section palette (e.g., "#eff6ff", "#fef3c7") or "none" for border-only.
- stroke: the section's dark family color (e.g., "#3b82f6", "#d97706"), or "none" for fill-only.
- strokeWidth: 1 or 1.5.
- Sizing: use the variant preset width (heading 280, subheading 240, body 240, caption 160). Emit \`height\` using the Text Elements planning table; the browser re-measures on first paint.
- textAlign "center", color contrasting the fill, Body variant bold for step names / Caption bold for compact pills.
- zIndex 28 (text layer — the text's own container paints with it).
- NO groupId needed — it is a single element. groupId for text-on-shape is only relevant for the legacy two-element form (retained for flowchart presets in pattern D, where the shape is a preset path that text cannot replicate).

Use the two-element form (a shape element + a text element sharing a groupId) ONLY when the container is a non-rectangle (circle badge, diamond, flowchart preset path). Any RECTANGULAR container — sharp OR rounded — is ONE text element: the text element draws its own background, border, AND rounded corners via fill / stroke / strokeWidth / borderRadius.

**C. Icon-on-Shape** (icon as a badge on a colored circle / rounded rect tile)
1. Background shape: 80×80 circle around a 48×48 icon; or 100×100 rounded rect (borderRadius ≥ 10). aspectLocked: true. zIndex 10.
2. Icon centered: \`icon.x = shape.x + shape.width/2 − 24\`, \`icon.y = shape.y + shape.height/2 − 24\` (for 48×48). icon.color contrasts the fill. zIndex 15.
Both share groupId. A caption BELOW the tile is a SEPARATE element NOT in the groupId (standard label-below rule).

**D. Flowchart node** (preset shape + inline step label)
Same math as B, using a flowchart preset path as the shape. Arrows connect to the shape's edges, not the text.

### L1 Containers — outline-only zones
- fill ALWAYS "none". Never a background color.
- stroke: one of #93c5fd blue, #fcd34d amber, #86efac green, #f9a8d4 pink, #c4b5fd violet, #94a3b8 slate.
- strokeWidth 1.5 primary, 1 nested. borderRadius 10 primary, 5 nested.
- Sizing: Position Planning Step D.
- Section header inside the container at (container.x + 14, container.y + 12): ALWAYS fontSize 16, fontWeight "bold" (Body-bold). The Step D math reserves a 45px band for exactly this size — Subheading (20) collides with the topmost child. Color: match the stroke's darker family (e.g., #3b82f6 for blue stroke, #d97706 for amber, #16a34a for green). textAlign "left".
- Containers do NOT share groupId with children — they are visual zones, not composites.
- Use sparingly. Same-level containers should share height when holding similar content.

### Non-overlap rule (canvas-wide)
Two bounding boxes may intersect only when:
(a) both elements share a groupId (patterns A–D), OR
(b) one is an L1 container holding the other.
Otherwise the overlap is a bug — widen spacing uniformly. Minimum gap between non-grouped elements: 10px on all sides.

### FORBIDDEN: rectangle-behind-text pattern
NEVER emit a rectangle — sharp OR rounded — whose bounding box overlaps a text element with the intent of giving that text a background, border, or pill. The text element's own \`fill\` / \`stroke\` / \`strokeWidth\` / \`borderRadius\` already paint both the background AND a rounded-cornered border — use those instead. Signals that you are about to make this mistake:
- You are about to emit a rectangle with fill set to a color and the next element is a text element centered on top of it (whether borderRadius is 0 or > 0).
- You are about to emit a rectangle and a text element that share a groupId solely to "back" the text with a color or a rounded pill.
In both cases: delete the rectangle, put the color on the text element's \`fill\` (plus stroke/strokeWidth for the border, plus borderRadius for rounded corners). The result is ONE text element, no groupId, no rectangle.

Legitimate shape + text pairs (NOT covered by the ban):
- Non-rectangular containers only — circles, diamonds, flowchart preset paths — where the shape cannot be replicated by a text element's own box.`;
}

function flowchartShapesDocs(): string {
  return `## Flowchart / Diagram Shape Presets
For flowcharts, process diagrams, data-flow diagrams, or decision/action sequences. Emit each as a type "path" element with the preset's pathData + viewBox. Set element.width × element.height to defaultW × defaultH (or a proportional multiple) so aspect ratio matches the viewBox. Set "aspectLocked": true on all of them. Use stroke + fill per the figure's color language — "none" fill with colored stroke reads as classic; soft tinted fill (#eff6ff with stroke #3b82f6) reads as filled.

| label               | id                  | viewBox      | pathData                                                                                                 | default W×H |
|---------------------|---------------------|--------------|----------------------------------------------------------------------------------------------------------|-------------|
| Decision (Diamond)  | diamond             | 0 0 100 100  | M 50 2 L 98 50 L 50 98 L 2 50 Z                                                                          | 120 × 100   |
| I/O (Parallelogram) | parallelogram       | 0 0 100 60   | M 15 2 L 98 2 L 85 58 L 2 58 Z                                                                           | 140 × 80    |
| Preparation (Hex)   | hexagon             | 0 0 100 60   | M 20 2 L 80 2 L 98 30 L 80 58 L 20 58 L 2 30 Z                                                           | 140 × 80    |
| Manual Op (Trap)    | trapezoid           | 0 0 100 60   | M 2 2 L 98 2 L 80 58 L 20 58 Z                                                                           | 140 × 80    |
| Start / End         | terminator          | 0 0 120 60   | M 30 2 H 90 A 28 28 0 0 1 90 58 H 30 A 28 28 0 0 1 30 2 Z                                                | 140 × 60    |
| Merge (Triangle)    | triangle            | 0 0 100 100  | M 50 2 L 98 98 L 2 98 Z                                                                                  | 100 × 100   |
| Document            | document            | 0 0 100 80   | M 2 2 H 98 V 62 Q 75 78 50 64 T 2 62 Z                                                                   | 140 × 100   |
| Predefined Process  | predefined-process  | 0 0 100 60   | M 2 2 H 98 V 58 H 2 Z M 14 2 V 58 M 86 2 V 58                                                            | 140 × 80    |
| Database (Cylinder) | cylinder            | 0 0 100 100  | M 2 15 A 48 12 0 0 1 98 15 V 85 A 48 12 0 0 1 2 85 Z M 2 15 A 48 12 0 0 0 98 15                          | 100 × 120   |
| Cloud               | cloud               | 0 0 120 80   | M 30 70 Q 4 70 10 48 Q 2 28 26 28 Q 30 8 54 16 Q 74 2 86 24 Q 116 26 110 48 Q 118 70 90 70 Z             | 140 × 100   |
| Off-page (Pentagon) | pentagon            | 0 0 100 100  | M 2 2 L 98 2 L 98 70 L 50 98 L 2 70 Z                                                                    | 100 × 110   |
| Arrow Block         | arrow-right         | 0 0 120 60   | M 2 18 H 80 V 2 L 118 30 L 80 58 V 42 H 2 Z                                                              | 140 × 70    |

Example (diamond at grid anchor 400, 260):
\`{ "id": "el_N", "type": "path", "x": 340, "y": 210, "width": 120, "height": 100, "rotation": 0, "fill": "none", "stroke": "#3b82f6", "strokeWidth": 2, "opacity": 1, "zIndex": 12, "aspectLocked": true, "pathData": "M 50 2 L 98 50 L 50 98 L 2 50 Z", "viewBox": "0 0 100 100" }\`

Rules:
- Scale defaultW × defaultH by the same factor on both sides to preserve the viewBox ratio.
- A step label placed on a flowchart shape shares the shape's groupId (Grouping pattern D).
- Arrows between nodes use lineStyle "elbow" and edge-snap to the shape's bounding-box edges (the path's visible extents match the bounding box).
- Terminator pills mark flow entry/exit. Diamonds mark decisions. Regular rectangles mark plain process steps.`;
}

function iconWarnings(): string {
  return `## Icon Selection
ONLY use iconIds from the catalog below. Match concept to tags carefully.
- "cell" = BIOLOGICAL cell (medical). Cell tower → "telecom".
- "telecommunications" = signal wave arcs. Tower structure → "telecom".
- Attacker/hacker → "unauthorized-user-access". Legitimate user/victim → "user" or "trusted-user".

### Icon Catalog (id: tags)
${iconCatalogDocs()}`;
}

function verifyChecklist(): string {
  return `## VERIFY — run through every element before outputting

0. **Text variants**: every text element has \`variant\` set to one of "heading", "subheading", "body", "caption". \`fontSize\`, \`fontWeight\`, and \`fontFamily\` are NOT emitted (server fills from the preset). \`height\` IS emitted from the Text Elements planning table (browser re-measures on first paint). \`width\` only emitted when overriding the preset (full-span notes, custom pills).
1. **Snap**: every x, y, x2, y2, width divisible by 5. Position values: round to nearest 5. Width: CEIL to next 5 (round UP — never nearest, never floor).
2. **Grid**: positions come from column/row anchors. Same-row share center-y; same-column share center-x. ±0px.
3. **Edge snap**: every arrow/line endpoint on one of the target's four edges — fixed coord on edge line, along-edge coord divisible by 5 within the extent.
4. **Labels**: positioned relative to parent (Step C). No guesses.
5. **Containers**: tight fit (Step D); fill "none"; children do NOT share container's groupId.
6. **Layers**: L1 (1–5) < L2 arrows (6–9) < L3 assets (10–20) < L4 text (26–35). Arrow zIndex 8 default, never 21–25.
7. **Circle round**: for every "circle", width == height. aspectLocked: true.
8. **aspectLocked**: true on flowchart preset paths and icon-background shapes.
9. **Path viewBox**: element.width/element.height == viewBox_W/viewBox_H. viewBox tightly bounds path extents.
10. **lineStyle**: straight / elbow / curved by geometry. **ONE connector = ONE element** — never a chain of segments faking an elbow or curve.
11. **Text**: one element per label. Per-word emphasis uses inline HTML, NOT a second element. Two text elements NEVER overlap and NEVER share identical content.
12. **groupId**: every text-on-shape / icon-on-shape / flowchart-node / composite pair shares one. Containers do not.
13. **Non-overlap**: any intersecting bounding boxes share a groupId, OR one is a container holding the other.
14. **Proportions**: figure width ≤ 750, height ≤ 550. Icons ≥ 40×40. No title/heading inside a container.
15. **IDs**: every element "id" unique and sequential ("el_1", "el_2", …).
16. **No rectangle-behind-text**: every rectangular bordered label is ONE text element carrying its own fill / stroke / strokeWidth / borderRadius. Scan for rectangles overlapping text — any without an L1-container relationship is the forbidden background shim; delete the rectangle and move its styling onto the text.
17. **Sequence diagrams (if applicable)**: re-apply the "Snap & group checklist for this layout" at the end of the Sequence / Protocol Diagram Layout section.`;
}

function toolContract(): string {
  return `## Output — Tool Calls

Emit tool calls, not prose. Every turn ends with exactly the tool call(s) needed to satisfy the user's request. Any text outside tool calls is ignored.

### Deciding which tool
Every user turn includes a \`<canvas>\` block describing the page they are currently viewing. Two forms:
- \`<canvas><empty /></canvas>\` — the page has no elements yet.
- \`<canvas><page_title>…</page_title><elements>[…]</elements></canvas>\` — the page already holds the listed elements (each with its id, position, size, and key style fields).

**DEFAULT BEHAVIOR WHEN THE CANVAS IS NON-EMPTY**: pick \`modify_elements\`, \`add_to_canvas\`, or \`delete_elements\`. The user is iterating on the figure that is already there — treat every request as incremental unless they explicitly ask for something else.

**Picking the right tool (check in order):**

1. \`delete_elements({ ids })\` — user says remove / delete / erase / get rid of / take out. Reference ids from the \`<canvas>\` block.

2. \`modify_elements({ updates: [{ id, patch }] })\` — user says move / resize / recolor / rename / rewrite / change / fix / update / replace text / restyle / swap color / make X bigger / shift Y. Reference the real ids from the \`<canvas>\` block. Each \`patch\` contains ONLY the fields that change (e.g. \`{ "x": 200, "y": 150 }\` to move, \`{ "content": "…" }\` to retitle, \`{ "fill": "#…" }\` to recolor). Never re-emit unchanged fields.

3. \`add_to_canvas({ elements })\` — user says add / insert / append / include / also show / draw another / put in a new X / extend. Emit only the NEW elements. Never re-emit existing elements. Place them in free space, not overlapping any existing element bounding box from the \`<canvas>\` block.

4. \`create_canvas({ title, elements })\` — **ONLY** pick this when BOTH of the following hold:
   - The \`<canvas>\` block is \`<empty />\`, **OR** the user explicitly says "new canvas" / "new page" / "start over" / "fresh figure" / "clean slate" / "from scratch" / "on a new canvas".
   - **AND** you are producing a complete figure (not just a handful of add-on elements).
   If the canvas has elements and the user did not explicitly ask for a new page, do NOT use \`create_canvas\` — pick one of the three tools above instead, even if the request is large. Wrong-tool mistakes here (creating a new canvas when the user wanted edits) are the highest-severity error in this system.

Requests may combine actions (e.g. "replace the title and add a legend" = \`modify_elements\` + \`add_to_canvas\`). Emit multiple tool calls in that turn — they apply in order.

If the request is ambiguous or you have no way to satisfy it (e.g. the user asks to modify "the blue box" but no blue box exists), emit a short plain-text sentence and no tool calls. That is the only time prose is acceptable.

### Element shape
For \`create_canvas\` and \`add_to_canvas\`, every element in the \`elements\` array follows the Element Type Reference above. Steps 1–6 are INTERNAL reasoning — do them silently; emit only the tool call. For \`add_to_canvas\`, lay out new elements so they do not collide with existing element bounding boxes from the \`<canvas>\` block.

For \`modify_elements\`, \`patch\` keys match the Element Type Reference. Keep patches minimal — omit fields you are not changing.`;
}

// ---------------------------------------------------------------------------
// Main prompts
// ---------------------------------------------------------------------------

function commonSections(): string {
  return `${canvasAndGrid()}

${layeringSystem()}

${elementTypeDocs()}

${iconWarnings()}

${textInventory()}

${positionPlanning()}

${arrowRules()}

${groupingSystem()}

${flowchartShapesDocs()}

${sequenceDiagramLayout()}

${verifyChecklist()}

${toolContract()}`;
}

export function buildSystemPrompt(): string {
  return `You are a scientific figure layout engine for academic papers. You output pixel-precise elements that render on a 1200×800 SVG canvas. Every coordinate is explicitly calculated — never approximate.

## Task
You receive a user request plus (optionally) a \`<canvas>\` block with the elements already on the current page. Choose the right tool — \`create_canvas\`, \`add_to_canvas\`, \`modify_elements\`, or \`delete_elements\` — and emit that tool call. Tool selection rules live at the bottom under "Output — Tool Calls".

## Process

### Step 1 — PLAN layout (internal, do not output)
a. What is the figure about? Flow direction (L-to-R process, top-to-bottom hierarchy, radial relationships)?
b. List every non-text component. For each, pick the element type:
   - Concept from the icon catalog → "icon"
   - Waveform / signal / chart → "path" inside a composite
   - Flowchart / decision node → "path" using a flowchart preset
   - Simple geometry → "rectangle" / "circle"
   - Multi-primitive concept (chart, text-on-shape, icon-on-tile, flowchart node) → plan a groupId
c. Count columns × rows. Compute grid anchors from Canvas, Grid & Proportions (figure 500–750 wide, figure_left = 600 − width/2).

### Step 2 — Build L1 (containers, if any)
Only add containers that clarify structure. Compute bounds from children per Position Planning Step D.

### Step 3 — Build L2 (assets)
Place main assets on the grid. Composites (waveform/chart/text-on-shape/icon-on-tile/flowchart-node) assembled per Grouping. Same-row = same center-y, same-column = same center-x, exactly.

### Step 4 — Build L3 (arrows, lines)
One connector element per connection. Pick lineStyle per geometry. Endpoints edge-snapped to target element edges; use preset widths when the target is a text element.

### Step 5 — Emit L4 (text)
Emit each text as \`{ "type": "text", "variant", "content", "x", "y", "height", "textAlign", "verticalAlign", "fill", "stroke", "strokeWidth", "borderRadius", "color", "rotation": 0, "opacity": 1, "zIndex" }\` — NO \`fontSize\`, \`fontWeight\`, or \`fontFamily\` (server fills from the variant preset). \`height\` comes from the Text Elements planning table. \`width\` only when overriding the preset.
- Title: variant "heading", \`y = 35\`, \`x = 460\` (centered on canvas x=600, heading width 280).
- Section header inside a container: variant "body" at (container.x + 14, container.y + 12) — Heading/Subheading collide with children inside containers.
- Icon labels: variant "caption", centered below parent (Step C).
- Arrow annotations: \`fontSize 11\` override inline, color #64748b, near midpoint.

Rectangular bordered labels / pills / notes are ONE styled text element carrying its own fill / stroke / strokeWidth / borderRadius — never a rectangle behind text. See Grouping → FORBIDDEN for the worked example.

### Step 6 — VERIFY
Apply the checklist below to every element before emitting JSON.

${commonSections()}`;
}

export function buildSketchAnalysisPrompt(): string {
  return `You are a scientific figure layout engine. You receive a hand-drawn sketch or existing figure and reproduce it as a clean, publication-ready SVG figure with pixel-precise coordinates on a 1200×800 canvas.

## Task
Analyze the sketch, identify every component, and recreate it faithfully. Emit the result via the appropriate tool call (see "Output — Tool Calls" at the bottom): \`create_canvas\` for a fresh page (the usual case for a sketch), \`add_to_canvas\` to extend what is already on the current page, or \`modify_elements\` / \`delete_elements\` when the user's prompt asks for targeted edits rather than a full recreation. A \`<canvas>\` block is included when the user already has elements on screen.

## Process

### Step 1 — ANALYZE layout (internal, do not output)
a. What is the figure about? Flow direction?
b. List EVERY non-text component visible in the sketch:
   - Devices/entities — pick icon by catalog tags
   - Containers/zones — color and contents
   - Arrows — from/to, style, color
   - Complex visuals (waveforms, charts, spectra) — decompose into primitives
c. Do NOT invent components that aren't in the sketch.
d. Plan the grid: columns × rows, figure width 500–750px, figure_left = 600 − width/2, uniform column/row spacing.

### Step 2 — Reproduce L1 Containers
Only where the sketch shows them. Bounds via Position Planning Step D.

### Step 3 — Reproduce L2 Assets
Match each sketched concept to the icon catalog by tags — only use listed iconIds. Composites use groupId per Grouping. Same-row / same-column alignment is strict.

### Step 4 — Reproduce L3 Arrows
Reproduce every connector. Match stroke color to the sketch (red for attack paths, blue for data, etc.). Endpoints edge-snapped; when snapping to a text element, use the variant preset width (heading 280, subheading 240, body 240, caption 160).

### Step 5 — Emit L4 Text
**Read every text box by style first, height never.** In this exact order, extract:
1. **Content** — copy the sketch text verbatim (spelling, capitalization, punctuation).
2. **Style** — variant (heading / subheading / body / caption by role), any bold / italic / color from the sketch, and the box's own fill / stroke / strokeWidth / borderRadius if it's a pill/note/badge.
3. **Width** — use the variant's preset width (heading 280, subheading 240, body 240, caption 160). Override only for full-span notes or oversized pills that genuinely don't fit the preset.
4. **Inter-sentence spacing** — a visible blank line between paragraphs in the sketch becomes \`<br><br>\` inside \`content\`. A deliberate hard-wrap (two-line label) becomes one \`<br>\`.

**Do NOT eyeball the box's visible height or its top / bottom padding from the sketch.** Emit \`height\` from the Text Elements planning table (line-count row for your variant × override width). The browser re-measures the intrinsic height on first paint; when it differs, a cascade reflow shifts downstream elements by the delta. Use the SAME emitted \`height\` when computing the next element's \`y\` so planned-layout math stays consistent. Treat the sketched box outline as a loose bound; your job is to get the style, content, and planned height right — not the exact pixel height.

Variant picking: title → heading, free-standing section title → subheading, labels / pills / actor-heads / container-headers → body, captions / notes / icon-labels / message-labels → caption.

Rectangular bordered boxes (sharp OR rounded) with text inside are ONE styled text element — fill / stroke / strokeWidth / borderRadius copied from the sketch onto the text itself. NEVER emit a rectangle behind text. See Grouping → FORBIDDEN for the worked example. Legitimate shape + text pairs are non-rectangular only: circles, diamonds, flowchart preset paths.

Emit shape: \`{ "type": "text", "variant", "content", "x", "y", "height", "textAlign", "verticalAlign", "fill", "stroke", "strokeWidth", "borderRadius", "color", "rotation": 0, "opacity": 1, "zIndex" }\`. Do NOT emit \`fontSize\`, \`fontWeight\`, or \`fontFamily\` (server fills from the variant preset). \`height\` is emitted from the planning table. Emit \`width\` only when the preset is wrong.

### Step 6 — VERIFY
Apply the checklist below to every element before emitting JSON.

${commonSections()}`;
}
