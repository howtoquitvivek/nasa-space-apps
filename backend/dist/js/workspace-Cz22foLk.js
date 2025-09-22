import"./modulepreload-polyfill-B5Qt9EMX.js";import{_ as z}from"./preload-helper-D7HrI6pR.js";function k({footprint:v,datasetId:f}){return new Promise(async p=>{let g,o=[],n=0,s=0,c=0;const y=30,d=`
            <div class="modal-overlay">
                <dialog class="modal-card">
                    <div class="modal-content">
                        <div class="text-center">
                            <h2 class="modal-title">Configure Analysis Area</h2>
                            <p class="modal-subtitle">
                                You have selected:
                                <strong class="modal-footprint-title">${v.title}</strong>
                            </p>
                        </div>
                        <div id="status-message-container"></div>
                        <div class="modal-section" id="zoom-controls-container"></div>
                        <div class="modal-info-box" id="size-info-container"></div>
                        <div class="modal-footer">
                            <button id="cancel-btn" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button id="confirm-btn" class="btn btn-cta">
                                <i class="fas fa-download me-2"></i>
                                Confirm & Download
                            </button>
                        </div>
                    </div>
                </dialog>
            </div>
        `,e=document.createElement("div");e.innerHTML=d,document.body.appendChild(e),g=e.querySelector("dialog");const m=e.querySelector("#status-message-container"),x=e.querySelector("#zoom-controls-container"),S=e.querySelector("#size-info-container"),_=e.querySelector("#confirm-btn"),I=e.querySelector("#cancel-btn");let b={mb:0,count:0},u=[];async function M(){const l=v.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");try{const a=await fetch(`http://localhost:8000/ingest/status/${f}/${l}`);a.ok&&(u=(await a.json()).existingZooms||[])}catch(a){console.error("Could not fetch status:",a),u=[]}}function L(l,a,h){let t=0;if(!l)return{count:0,mb:0};for(const i of o)i>=h&&i<=a&&(t+=l[i].count);return{count:t,mb:t*y/1024}}function E(){b=L(v.downloadInfo.tilesPerZoom,c,n),u.length>0&&(m.innerHTML=`
                    <div class="status-badge status-success">
                        <div class="status-text">
                            Already downloaded zooms: ${Math.min(...u)}-${Math.max(...u)}
                        </div>
                    </div>
                `),n>s?(x.innerHTML=`
                    <div class="text-center font-semibold text-gray-light">
                        ✅ All available zooms have already been downloaded!
                    </div>
                `,_.disabled=!0):(x.innerHTML=`
                    <label for="zoom-slider" class="modal-label">
                        Select Max Zoom to Download (${n}-${s})
                    </label>
                    <p class="modal-hint">
                        Higher zoom means more detail but larger download size.
                    </p>
                    <input
                        type="range"
                        id="zoom-slider"
                        min="${n}"
                        max="${s}"
                        value="${c}"
                        class="modal-slider"
                    />
                    <div class="modal-slider-labels">
                        <span>Zoom ${n}</span>
                        <span>Zoom ${s}</span>
                    </div>
                `,_.disabled=!1,e.querySelector("#zoom-slider").addEventListener("input",a=>{c=a.target.value,E()})),S.innerHTML=`
                <p class="modal-info-text">
                    Estimated Download (up to Zoom ${c}):
                    <span class="modal-info-value">${b.mb.toFixed(2)} MB</span>
                </p>
                <p class="modal-info-hint">Total tiles: ${b.count}</p>
            `}if(await M(),o=Object.keys(v.downloadInfo.tilesPerZoom).map(Number).sort((l,a)=>l-a),o.length>0){const l=u.length?Math.max(...u):-1;n=Math.max(o[0],l+1),s=o[o.length-1],c=s}E(),g.showModal(),I.addEventListener("click",()=>{g.close(),p(null)}),_.addEventListener("click",()=>{g.close(),p({minZoom:n,maxZoom:c})}),g.addEventListener("close",()=>{document.body.removeChild(e)})})}document.addEventListener("DOMContentLoaded",()=>{const f=new URLSearchParams(window.location.search).get("datasetId");let p=null;const o={mars_viking_vis:{id:"mars_viking_vis",name:"Mars: Viking VIS Global Color Mosaic",tileUrl:"https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg",maxZoom:7},venus_magellan_gt:{id:"venus_magellan_gt",name:"Venus: Magellan Global Topography",tileUrl:"https://trek.nasa.gov/tiles/Venus/EQ/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m/1.0.0/default/default028mm/{z}/{y}/{x}.png",maxZoom:7},mercury_messenger_mds:{id:"mercury_messenger_mds",name:"Mercury: MESSENGER Global Mosaic",tileUrl:"https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg",maxZoom:8}}[f]||null,n=document.getElementById("loading-overlay"),s=document.getElementById("status-message"),c=document.querySelector(".panel-content");if(!o){document.getElementById("map-container").innerHTML=`
            <div class="empty-state-container">
                <div class="empty-state-card">
                    <h2 class="empty-state-title">No Project Selected</h2>
                    <p class="empty-state-text">
                        Go to the <a href="/home" class="empty-state-link">Home Dashboard</a> to start a project.
                    </p>
                </div>
            </div>`;return}let y,d,e,m=null;async function x(){d=(await z(async()=>{const{default:i}=await import("./leaflet-src-BllHigrc.js").then(r=>r.l);return{default:i}},[])).default;const t=d.icon({iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",iconSize:[25,41],iconAnchor:[12,41],shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"});d.Marker.prototype.options.icon=t,y=d.map("map-container",{crs:d.CRS.EPSG4326,center:[0,0],zoom:1,maxZoom:o.maxZoom,zoomControl:!1}),d.tileLayer(o.tileUrl,{maxZoom:o.maxZoom,noWrap:!0,attribution:o.name}).addTo(y),e=new d.FeatureGroup().addTo(y),await S(),await u()}async function S(){M("Loading footprints...");try{const t=await fetch(`/${f}_footprints.json`);if(!t.ok)throw new Error("Failed to load footprints");const i=await t.json();e.clearLayers(),i.forEach(r=>{const[w,C,Z,$]=r.bbox;d.rectangle([[C,w],[$,Z]],{color:"white",weight:.7,fillOpacity:.1}).addTo(e).on("click",()=>{m=r,_()})}),e.getLayers().length>0&&y.fitBounds(e.getBounds(),{padding:[50,50]})}catch(t){console.error(t),alert("Failed to load footprints")}finally{L()}}function _(){k({footprint:m,datasetId:o.id}).then(t=>{t&&I(t)})}function I(t){if(!m){console.error("No footprint selected!");return}const i={footprintId:m.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""),datasetId:o.id,tileUrl:m.tileUrl,tilesPerZoom:m.downloadInfo.tilesPerZoom,minZoom:t.minZoom,maxZoom:t.maxZoom};b(i)}async function b(t){M("Sending request to backend..."),p=new AbortController;const{signal:i}=p;try{const w=await(await fetch("http://localhost:8000/ingest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t),signal:i})).json();s.textContent=`✅ Success! New data for '${w.dataset_id}' is ready.`}catch(r){r.name==="AbortError"?s.textContent="Ingestion canceled by user.":(console.error(r),s.textContent=`Error: ${r.message}`)}finally{setTimeout(L,3e3),p=null}}async function u(){n.classList.remove("hidden"),s.textContent="Loading analysis areas...";try{const t=await fetch(`http://localhost:8000/datasets/${f}/footprints`);if(!t.ok)throw c.innerHTML='<p class="status-text">Failed to load analysis areas.</p>',new Error("Failed to fetch analysis areas from API");const r=(await t.json()).footprints||[];if(r.length===0)c.innerHTML='<p class="status-text">No downloaded areas found for this dataset.</p>';else{const w=r.map(C=>{const Z=C.replace(/_/g," "),$=`/analysis?dataset=${f}&footprint=${C.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}`;return`
                        <li class="list-item">
                            <span class="footprint-name">${Z}</span>
                            <a href="${$}" class="open-button">Open</a>
                        </li>
                    `}).join("");c.innerHTML=`<ul class="footprint-list">${w}</ul>`}}catch(t){console.error("Error loading downloads panel:",t),s.textContent="Failed to load analysis areas."}finally{n.classList.add("hidden")}}function M(t){n&&s&&(n.style.display="flex",s.textContent=t)}function L(){n&&(n.style.display="none")}x();const E=document.querySelector(".sidebar-container"),l=document.querySelector(".toggle-btn");let a=!0;l==null||l.addEventListener("click",()=>{a=!a,E.classList.toggle("collapsed",!a),l.textContent=a?"⏴":"⏵"});const h=document.getElementById("cancel-ingestion");h==null||h.addEventListener("click",()=>{if(!p||(p.abort(),!m))return;const t={datasetId:o.id,footprintId:m.title.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")};fetch("http://localhost:8000/ingest/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}).catch(i=>console.error("Failed to send cancel signal:",i))})});
